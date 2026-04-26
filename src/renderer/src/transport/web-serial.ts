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
// we fall back to the vendor-id table.
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
        const label = nameFromUsb(info, usbNames) ?? fallbackLabel(info)
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
    const usbNames = await buildUsbNameMap()
    const label = nameFromUsb(info, usbNames) ?? fallbackLabel(info)

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

export async function requestAndConnect(): Promise<RpcTransport> {
    if (!navigator.serial) throw new Error('Web Serial not supported')
    const port = await navigator.serial.requestPort({})
    const info = port.getInfo()
    const id = makeId(info, portRegistry.size)
    portRegistry.set(id, port)

    // Best-effort: also acquire WebUSB permission for the same vid/pid so the
    // device shows a real productName next time without an extra prompt. If
    // the user cancels this second dialog, we silently fall back.
    if (
        typeof navigator !== 'undefined' &&
        'usb' in navigator &&
        info.usbVendorId !== undefined &&
        info.usbProductId !== undefined
    ) {
        try {
            await navigator.usb.requestDevice({
                filters: [
                    {
                        vendorId: info.usbVendorId,
                        productId: info.usbProductId,
                    },
                ],
            })
        } catch (e) {
            console.log(
                '[web-serial] WebUSB grant skipped (label will use fallback)',
                e,
            )
        }
    }

    return openTransport(port)
}
