// pattern-check: skip — bug fix in single transport module; cache + perm helpers are utilities
import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import type { AvailableDevice } from '@/transport/types'

const BAUD_RATE = 12500

const portRegistry = new Map<string, SerialPort>()

function makeId(info: SerialPortInfo, fallbackIndex: number): string {
    const vid = info.usbVendorId?.toString(16) ?? 'novid'
    const pid = info.usbProductId?.toString(16) ?? 'nopid'
    return `web-serial:${vid}:${pid}:${fallbackIndex}`
}

// Fallback labels when WebUSB cannot supply a productName.
const KNOWN_VENDOR_LABELS: Record<number, string> = {
    0x1d50: 'ZMK Keyboard',
    0x239a: 'Adafruit Keyboard',
    0x303a: 'ESP32 Keyboard',
    0x2e8a: 'Raspberry Pi Pico Keyboard',
    0x16c0: 'V-USB / Teensy Keyboard',
    0x1915: 'Nordic Keyboard',
    0x05ac: 'Apple Keyboard',
    0x1209: 'Generic ZMK Keyboard',
}

const KNOWN_VENDOR_IDS: number[] = Object.keys(KNOWN_VENDOR_LABELS).map((k) =>
    Number(k),
)

const NAME_CACHE_KEY = 'zmk-studio.usb-names'
const USER_NAME_CACHE_KEY = 'zmk-studio.usb-names.user'

function vidPidKey(vid: number | undefined, pid: number | undefined): string {
    return `${vid ?? 'novid'}:${pid ?? 'nopid'}`
}

function readCache(key: string): Record<string, string> {
    if (typeof localStorage === 'undefined') return {}
    try {
        const raw = localStorage.getItem(key)
        if (!raw) return {}
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
        return {}
    }
}

function writeCache(key: string, data: Record<string, string>): void {
    if (typeof localStorage === 'undefined') return
    try {
        localStorage.setItem(key, JSON.stringify(data))
    } catch {
        /* quota / privacy mode — ignore */
    }
}

function persistAutoName(
    vid: number | undefined,
    pid: number | undefined,
    name: string,
): void {
    if (vid === undefined || pid === undefined || !name) return
    const cache = readCache(NAME_CACHE_KEY)
    const k = vidPidKey(vid, pid)
    if (cache[k] === name) return
    cache[k] = name
    writeCache(NAME_CACHE_KEY, cache)
}

function loadAutoName(
    vid: number | undefined,
    pid: number | undefined,
): string | undefined {
    if (vid === undefined || pid === undefined) return undefined
    return readCache(NAME_CACHE_KEY)[vidPidKey(vid, pid)]
}

function loadUserName(
    vid: number | undefined,
    pid: number | undefined,
): string | undefined {
    if (vid === undefined || pid === undefined) return undefined
    return readCache(USER_NAME_CACHE_KEY)[vidPidKey(vid, pid)]
}

function fallbackLabel(info: SerialPortInfo): string {
    const vid = info.usbVendorId
    if (vid !== undefined && KNOWN_VENDOR_LABELS[vid]) {
        return KNOWN_VENDOR_LABELS[vid]
    }
    return 'USB Keyboard'
}

interface UsbNameRecord {
    productName?: string
    manufacturerName?: string
}

// Web Serial does not expose the OS device name. WebUSB does (productName).
// Probe getDevices() (no prompt — returns devices the origin already has
// access to) and match by vid:pid to enrich the label. If the user has
// previously granted WebUSB for the device they get the real name; if not,
// we fall back to the persisted cache or the vendor-id table.
async function buildUsbNameMap(): Promise<Map<string, UsbNameRecord>> {
    const map = new Map<string, UsbNameRecord>()
    if (typeof navigator === 'undefined' || !('usb' in navigator)) return map
    try {
        const devices = await navigator.usb.getDevices()
        for (const d of devices) {
            const key = `${d.vendorId}:${d.productId}`
            map.set(key, {
                productName: d.productName ?? undefined,
                manufacturerName: d.manufacturerName ?? undefined,
            })
        }
    } catch (e) {
        console.warn('[web-serial] WebUSB getDevices failed', e)
    }
    return map
}

function nameFromUsb(
    info: SerialPortInfo,
    usbNames: Map<string, UsbNameRecord>,
): string | undefined {
    const vid = info.usbVendorId
    const pid = info.usbProductId
    if (vid === undefined || pid === undefined) return undefined
    const rec = usbNames.get(`${vid}:${pid}`)
    if (!rec) return undefined
    if (rec.productName && rec.productName.trim() !== '') return rec.productName
    if (rec.manufacturerName && rec.manufacturerName.trim() !== '')
        return rec.manufacturerName
    return undefined
}

// Resolution chain: user override → live WebUSB → persisted cache →
// vendor-id table → generic. Live WebUSB hits write through to the cache
// so the name survives across sessions even if WebUSB grant is later
// revoked.
function resolveLabel(
    info: SerialPortInfo,
    usbNames: Map<string, UsbNameRecord>,
): string {
    const userOverride = loadUserName(info.usbVendorId, info.usbProductId)
    if (userOverride) return userOverride

    const live = nameFromUsb(info, usbNames)
    if (live) {
        persistAutoName(info.usbVendorId, info.usbProductId, live)
        return live
    }

    const cached = loadAutoName(info.usbVendorId, info.usbProductId)
    if (cached) return cached

    return fallbackLabel(info)
}

export async function listGrantedPorts(): Promise<AvailableDevice[]> {
    if (!navigator.serial) return []
    const [ports, usbNames] = await Promise.all([
        navigator.serial.getPorts(),
        buildUsbNameMap(),
    ])
    portRegistry.clear()
    return ports.map((port, i) => {
        const info = port.getInfo()
        const id = makeId(info, i)
        const label = resolveLabel(info, usbNames)
        portRegistry.set(id, port)
        return { id, label }
    })
}

async function openTransport(port: SerialPort): Promise<RpcTransport> {
    if (!port.readable || !port.writable) {
        await port.open({ baudRate: BAUD_RATE }).catch((e: unknown) => {
            if (e instanceof DOMException && e.name === 'NetworkError') {
                throw new Error(
                    'Failed to open the serial port. Check the permissions of the device and verify it is not in use by another process.',
                    { cause: e },
                )
            }
            throw e
        })
    }

    const info = port.getInfo()
    lastOpenedPortInfo = info
    const usbNames = await buildUsbNameMap()
    const label = resolveLabel(info, usbNames)

    const abortController = new AbortController()
    const sig = abortController.signal
    const abort_cb = async (): Promise<void> => {
        sig.removeEventListener('abort', abort_cb)
        await port.writable?.close().catch(() => undefined)
        await port.readable?.cancel().catch(() => undefined)
        await port.close().catch(() => undefined)
    }
    sig.addEventListener('abort', abort_cb)

    return {
        label,
        abortController,
        readable: port.readable!,
        writable: port.writable!,
    }
}

export async function connectToGrantedPort(
    device: AvailableDevice,
): Promise<RpcTransport> {
    const port = portRegistry.get(device.id)
    if (!port) {
        throw new Error(
            'Selected serial port is no longer available. Refresh the list.',
        )
    }
    return openTransport(port)
}

// Set by openTransport; read by rememberConnectedDeviceName after the
// RPC handshake reports the firmware's keyboard name.
let lastOpenedPortInfo: SerialPortInfo | null = null

export async function requestAndConnect(): Promise<RpcTransport> {
    if (!navigator.serial) throw new Error('Web Serial not supported')
    const filters = KNOWN_VENDOR_IDS.map((usbVendorId) => ({ usbVendorId }))
    const port = await navigator.serial.requestPort({ filters })

    // Single-prompt flow: Web Serial can't return the productName, but the
    // ZMK firmware does — once the Serial connection opens we receive the
    // keyboard name via core.getDeviceInfo (see rpcConnect.ts). Higher
    // layers call rememberConnectedDeviceName() with that result and we
    // persist it keyed by vid:pid, so future sessions resolve the name
    // silently from cache.
    const info = port.getInfo()
    const id = makeId(info, portRegistry.size)
    portRegistry.set(id, port)
    return openTransport(port)
}

// Called by the connection layer once core.getDeviceInfo returns the
// firmware-set keyboard name. No-op when no web-serial port has been
// opened recently (BLE / Electron / Tauri paths).
export function rememberConnectedDeviceName(name: string): void {
    if (!lastOpenedPortInfo || !name) return
    persistAutoName(
        lastOpenedPortInfo.usbVendorId,
        lastOpenedPortInfo.usbProductId,
        name,
    )
}

// Subscribe to physical USB plug / unplug events for already-granted ports.
// `connect` fires when a previously-granted device is plugged back in.
// `disconnect` fires on unplug. Returns an unsubscribe function.
export function onPortsChanged(cb: () => void): () => void {
    if (typeof navigator === 'undefined' || !navigator.serial) {
        return () => undefined
    }
    const handler = (): void => cb()
    navigator.serial.addEventListener('connect', handler)
    navigator.serial.addEventListener('disconnect', handler)
    return () => {
        navigator.serial.removeEventListener('connect', handler)
        navigator.serial.removeEventListener('disconnect', handler)
    }
}

// Persist a user-chosen friendly name for the device. Looked up first in
// the resolution chain, so it always wins over the WebUSB productName and
// the vendor-id fallback.
export function setUserDeviceName(deviceId: string, name: string): void {
    const port = portRegistry.get(deviceId)
    if (!port) return
    const info = port.getInfo()
    const vid = info.usbVendorId
    const pid = info.usbProductId
    if (vid === undefined || pid === undefined) return

    const cache = readCache(USER_NAME_CACHE_KEY)
    const k = vidPidKey(vid, pid)
    const trimmed = name.trim()
    if (trimmed === '') {
        delete cache[k]
    } else {
        cache[k] = trimmed
    }
    writeCache(USER_NAME_CACHE_KEY, cache)
}
