// pattern-check: skip — parallel BLE backend, mirrors bluez.ts/serial.ts
// callback shape by convention, no class abstraction.
/**
 * Noble (raw HCI) BLE backend for Linux.
 *
 * Alternative to bluez.ts. Bypasses BlueZ's GATT cache by talking to the
 * Bluetooth controller directly through an HCI socket. Useful when BlueZ
 * appears to forward writes correctly but the device never indicates back
 * (suspected stale GATT state or BlueZ-specific issue).
 *
 * Prerequisites on Linux:
 *   sudo setcap cap_net_raw,cap_net_admin+eip $(eval readlink -f $(which node))
 *
 * Note: noble takes exclusive control of the adapter on Linux. While noble
 * is connected, BlueZ-managed connections (e.g. HID typing) on the same
 * adapter may be disrupted.
 */

import { createRequire } from 'module'
import type { AvailableDevice } from '../shared/ipc-types'
import { createLogger } from '../shared/logger'

const log = createLogger('noble')

// Lazy load noble — importing it eagerly opens an HCI socket and starts
// polling adapter state, which fails noisily when caps/perms aren't set.
// Renderer-side disabled-on-Linux gate means we usually never need this.
const nodeRequire = createRequire(import.meta.url)
type NobleModule = typeof import('@abandonware/noble')
let nobleMod: NobleModule | null = null
function getNoble(): NobleModule {
    if (!nobleMod) {
        nobleMod = nodeRequire('@abandonware/noble') as NobleModule
    }
    return nobleMod
}

const ZMK_SERVICE_UUID = '00000000019661 07c967c5cfb1c2482a'.replace(/\s/g, '')
const ZMK_CHAR_UUID = '00000001019661 07c967c5cfb1c2482a'.replace(/\s/g, '')
// noble strips dashes and lowercases service/char UUIDs.
const ZMK_SERVICE_UUID_NOBLE = ZMK_SERVICE_UUID.toLowerCase()
const ZMK_CHAR_UUID_NOBLE = ZMK_CHAR_UUID.toLowerCase()

export interface NobleEventCallbacks {
    onData: (data: number[]) => void
    onDisconnected: () => void
}

interface NobleDiscoveredPeripheral {
    id: string
    name: string
    peripheral: import('@abandonware/noble').Peripheral
}

interface ActiveNobleConnection {
    peripheral: import('@abandonware/noble').Peripheral
    characteristic: import('@abandonware/noble').Characteristic
    callbacks: NobleEventCallbacks
    onData: (data: Buffer, isNotification: boolean) => void
    onDisconnect: () => void
}

const SCAN_TIMEOUT_MS = 4000

let nobleReady = false
let active: ActiveNobleConnection | null = null
const discovered = new Map<string, NobleDiscoveredPeripheral>()

async function ensureNobleReady(): Promise<void> {
    if (nobleReady) return
    if (getNoble()._state === 'poweredOn') {
        nobleReady = true
        return
    }
    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('[noble] adapter never powered on'))
        }, 5000)
        getNoble().once('stateChange', (state: string) => {
            clearTimeout(timer)
            if (state === 'poweredOn') {
                nobleReady = true
                resolve()
            } else {
                reject(new Error(`[noble] adapter state=${state}`))
            }
        })
    })
}

export async function listNobleDevices(): Promise<AvailableDevice[]> {
    // noble supports Linux (BlueZ HCI) and macOS (CoreBluetooth) out of the
    // box. Windows is intentionally not enabled here — the native Web
    // Bluetooth bridge (ble-manager.ts) covers it.
    if (process.platform !== 'linux' && process.platform !== 'darwin') {
        return []
    }

    try {
        await ensureNobleReady()
    } catch (e) {
        log.error('adapter not ready:', e)
        return []
    }

    discovered.clear()
    const onDiscover = (
        peripheral: import('@abandonware/noble').Peripheral,
    ): void => {
        const name = peripheral.advertisement.localName || ''
        const services = peripheral.advertisement.serviceUuids || []
        const hasZmk = services.some(
            (u) => u.toLowerCase() === ZMK_SERVICE_UUID_NOBLE,
        )
        if (!hasZmk && !name) return
        if (!hasZmk) return
        discovered.set(peripheral.id, {
            id: peripheral.id,
            name: name || peripheral.address || 'BLE Device',
            peripheral,
        })
    }
    getNoble().on('discover', onDiscover)

    try {
        await getNoble().startScanningAsync([ZMK_SERVICE_UUID_NOBLE], false)
    } catch (e) {
        getNoble().removeListener('discover', onDiscover)
        log.error('startScanning failed:', e)
        return []
    }

    await new Promise((r) => setTimeout(r, SCAN_TIMEOUT_MS))

    try {
        await getNoble().stopScanningAsync()
    } catch {
        /* ignore */
    }
    getNoble().removeListener('discover', onDiscover)

    const out: AvailableDevice[] = []
    for (const d of discovered.values()) {
        out.push({ id: d.id, label: d.name })
    }
    log.info('scan returned', out.length, 'devices')
    return out
}

export async function connectNobleDevice(
    deviceId: string,
    callbacks: NobleEventCallbacks,
): Promise<string> {
    if (active) {
        await disconnectNobleDevice()
    }

    const entry = discovered.get(deviceId)
    if (!entry) {
        throw new Error(
            `[noble] device ${deviceId} not in discovered cache — list first`,
        )
    }

    const peripheral = entry.peripheral
    log.info(
        `connecting to ${peripheral.id} (${peripheral.advertisement.localName})`,
    )

    await peripheral.connectAsync()
    log.info('connected, discovering services')

    const { characteristics } =
        await peripheral.discoverSomeServicesAndCharacteristicsAsync(
            [ZMK_SERVICE_UUID_NOBLE],
            [ZMK_CHAR_UUID_NOBLE],
        )

    if (characteristics.length === 0) {
        await peripheral.disconnectAsync().catch(() => {})
        throw new Error('[noble] ZMK characteristic not found')
    }

    const characteristic = characteristics[0]
    log.info('char found, properties:', characteristic.properties)

    const onData = (data: Buffer, isNotification: boolean): void => {
        log.info(
            `${isNotification ? 'notify' : 'read'} ${data.length} bytes:`,
            Array.from(data.subarray(0, Math.min(16, data.length))),
        )
        callbacks.onData(Array.from(new Uint8Array(data)))
    }
    characteristic.on('data', onData)

    const onDisconnect = (): void => {
        log.info('peripheral disconnected')
        callbacks.onDisconnected()
    }
    peripheral.once('disconnect', onDisconnect)

    await characteristic.subscribeAsync()
    log.info('subscribed to char')

    active = {
        peripheral,
        characteristic,
        callbacks,
        onData,
        onDisconnect,
    }

    return entry.name
}

export async function writeNoble(data: Uint8Array): Promise<void> {
    if (!active) throw new Error('[noble] no active connection')
    const supportsWithoutResponse = active.characteristic.properties.includes(
        'writeWithoutResponse',
    )
    log.info(
        `write ${data.length} bytes (withoutResponse=${supportsWithoutResponse}):`,
        Array.from(data.subarray(0, Math.min(16, data.length))),
    )
    await active.characteristic.writeAsync(
        Buffer.from(data),
        supportsWithoutResponse,
    )
    log.info('write ok')
}

export async function disconnectNobleDevice(): Promise<void> {
    if (!active) return
    const a = active
    active = null

    try {
        a.characteristic.removeListener('data', a.onData)
    } catch {
        /* ignore */
    }
    try {
        a.peripheral.removeListener('disconnect', a.onDisconnect)
    } catch {
        /* ignore */
    }
    try {
        await a.characteristic.unsubscribeAsync()
    } catch {
        /* ignore */
    }
    try {
        await a.peripheral.disconnectAsync()
    } catch {
        /* ignore */
    }
}

export function hasActiveNobleConnection(): boolean {
    return active !== null
}
