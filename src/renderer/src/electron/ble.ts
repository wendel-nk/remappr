// pattern-check: skip — platform branch in renderer, no new abstraction
/**
 * Electron BLE transport adapter.
 *
 * Linux: talks to BlueZ via main-process D-Bus client. Lists paired devices
 * advertising the firmware studio service without user gesture or chooser dialog.
 * Connects via BlueZ GATT, so devices already paired+connected to the OS
 * are reachable (Web Bluetooth on Linux can't see them).
 *
 * Windows/macOS: uses Chromium Web Bluetooth via navigator.bluetooth.
 * Discovery via requestDevice() chooser, GATT in renderer.
 */

import { IpcChannels, IpcEvents } from '../../../shared/ipc-types'
import type { RpcTransport } from '@firmware/zmk'
import type { AvailableDevice } from '@/transport'

import { STUDIO_SERVICE_UUID, STUDIO_CHAR_UUID } from '@shared/ble-defaults'

/** Holds the pending requestDevice() promise between list_devices() and connect() */
let pendingDevicePromise: Promise<BluetoothDevice> | null = null

/** Duration to collect BLE device discoveries before returning the list (ms) */
const SCAN_COLLECTION_MS = 5000

/** Cached platform string from main process. */
let cachedPlatform: string | null = null
async function getPlatform(): Promise<string> {
    if (cachedPlatform) return cachedPlatform
    cachedPlatform = (await window.api.invoke(
        IpcChannels.GET_PLATFORM,
    )) as string
    return cachedPlatform
}

/**
 * Scan for available BLE devices.
 *
 * Linux: queries BlueZ for paired devices advertising the firmware service.
 * No user gesture required, no chooser dialog. Returns immediately.
 *
 * Other platforms: Web Bluetooth requestDevice() chooser flow.
 */
export async function list_devices(): Promise<AvailableDevice[]> {
    console.log('[electron/ble] list_devices() called')

    const platform = await getPlatform()
    if (platform === 'linux') {
        try {
            const devices = (await window.api.invoke(
                IpcChannels.BLUEZ_LIST_DEVICES,
            )) as AvailableDevice[]
            console.log(
                '[electron/ble] BlueZ returned',
                devices.length,
                'devices',
            )
            return devices
        } catch (e) {
            console.error('[electron/ble] BLUEZ_LIST_DEVICES failed:', e)
            return []
        }
    }

    if (!navigator.bluetooth) {
        console.warn('[electron/ble] navigator.bluetooth missing')
        return []
    }

    // Cancel any previous pending scan. Fire-and-forget to preserve
    // user-activation token for requestDevice() below.
    if (pendingDevicePromise) {
        window.api.invoke(IpcChannels.BLE_STOP_SCAN).catch(() => {})
        pendingDevicePromise = null
    }

    // Tell main to enter scan/collection mode. Do NOT await — Chromium
    // consumes the user-activation token across awaits, which would make
    // requestDevice() throw "must be handling a user gesture".
    window.api.invoke(IpcChannels.BLE_START_SCAN).catch((e) => {
        console.error('[electron/ble] BLE_START_SCAN failed:', e)
    })

    try {
        pendingDevicePromise = navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [STUDIO_SERVICE_UUID],
        })
    } catch (e) {
        console.error('[electron/ble] requestDevice threw:', e)
        return []
    }

    pendingDevicePromise.catch((e) => {
        console.warn('[electron/ble] requestDevice rejected:', e)
        pendingDevicePromise = null
    })

    return new Promise<AvailableDevice[]>((resolve) => {
        let latestDevices: AvailableDevice[] = []

        const unlisten = window.api.on(
            IpcEvents.BLE_DEVICES_DISCOVERED,
            (...args: unknown[]) => {
                latestDevices = args[0] as AvailableDevice[]
                console.log(
                    '[electron/ble] BLE_DEVICES_DISCOVERED:',
                    latestDevices.length,
                )
            },
        )

        setTimeout(() => {
            unlisten()
            console.log(
                '[electron/ble] scan window closed, returning',
                latestDevices.length,
                'devices',
            )
            resolve(latestDevices)
        }, SCAN_COLLECTION_MS)
    })
}

/**
 * Connect to a specific BLE device and return an RpcTransport.
 *
 * Linux: routes through main-process BlueZ client. dev.id is a D-Bus path
 * like /org/bluez/hci0/dev_CD_8F_C5_C5_8B_A4. Reads/writes flow over IPC
 * via TRANSPORT_SEND_DATA + CONNECTION_DATA event.
 *
 * Other platforms: GATT in renderer via Web Bluetooth.
 */
export async function connect(dev: AvailableDevice): Promise<RpcTransport> {
    const platform = await getPlatform()
    if (platform === 'linux') {
        return connectViaBluez(dev)
    }
    return connectViaWebBluetooth(dev)
}

async function connectViaBluez(dev: AvailableDevice): Promise<RpcTransport> {
    const result = (await window.api.invoke(
        IpcChannels.BLUEZ_CONNECT,
        dev.id,
    )) as { ok: boolean; label?: string; error?: string }

    if (!result.ok) {
        throw new Error(result.error ?? 'Failed to connect via BlueZ')
    }

    const abortController = new AbortController()

    const writable = new WritableStream<Uint8Array>({
        async write(chunk) {
            await window.api.invoke(
                IpcChannels.TRANSPORT_SEND_DATA,
                new Uint8Array(chunk),
            )
        },
    })

    const { writable: responseWritable, readable } =
        new TransformStream<Uint8Array>()

    const unlistenData = window.api.on(
        IpcEvents.CONNECTION_DATA,
        async (...args: unknown[]) => {
            const data = args[0] as number[]
            const writer = responseWritable.getWriter()
            await writer.write(new Uint8Array(data))
            writer.releaseLock()
        },
    )

    const unlistenDisconnected = window.api.on(
        IpcEvents.CONNECTION_DISCONNECTED,
        async () => {
            unlistenData()
            unlistenDisconnected()
            responseWritable.close().catch(() => {})
        },
    )

    const signal = abortController.signal
    const onAbort = async (): Promise<void> => {
        unlistenData()
        unlistenDisconnected()
        await window.api.invoke(IpcChannels.TRANSPORT_CLOSE).catch(() => {})
        signal.removeEventListener('abort', onAbort)
    }
    signal.addEventListener('abort', onAbort)

    return {
        label: result.label ?? dev.label ?? 'BLE Device',
        abortController,
        readable,
        writable,
    }
}

async function connectViaWebBluetooth(
    dev: AvailableDevice,
): Promise<RpcTransport> {
    if (!navigator.bluetooth) {
        throw new Error(
            'Web Bluetooth API not available in this Electron build',
        )
    }

    const selected = await window.api.invoke(
        IpcChannels.BLE_SELECT_DEVICE,
        dev.id,
    )
    if (!selected) {
        throw new Error('Failed to select BLE device')
    }

    if (!pendingDevicePromise) {
        throw new Error('No pending BLE scan — call list_devices() first')
    }

    const device = await pendingDevicePromise
    pendingDevicePromise = null

    if (!device.gatt) {
        throw new Error('GATT not available on selected device')
    }

    const server = await device.gatt.connect()
    const service = await server.getPrimaryService(STUDIO_SERVICE_UUID)
    const characteristic = await service.getCharacteristic(STUDIO_CHAR_UUID)
    await characteristic.startNotifications()

    const abortController = new AbortController()

    const { writable: responseWritable, readable } =
        new TransformStream<Uint8Array>()

    const onCharacteristicChanged = async (event: Event): Promise<void> => {
        const target = event.target as BluetoothRemoteGATTCharacteristic
        const value = target?.value
        if (value) {
            const writer = responseWritable.getWriter()
            await writer.write(new Uint8Array(value.buffer))
            writer.releaseLock()
        }
    }

    characteristic.addEventListener(
        'characteristicvaluechanged',
        onCharacteristicChanged,
    )

    const writable = new WritableStream<Uint8Array>({
        async write(chunk) {
            await characteristic.writeValueWithoutResponse(
                new Uint8Array(chunk),
            )
        },
    })

    const onDisconnected = (): void => {
        cleanup()
        responseWritable.close().catch(() => {})
    }

    device.addEventListener('gattserverdisconnected', onDisconnected)

    const cleanup = (): void => {
        characteristic.removeEventListener(
            'characteristicvaluechanged',
            onCharacteristicChanged,
        )
        device.removeEventListener('gattserverdisconnected', onDisconnected)
    }

    const onAbort = (): void => {
        cleanup()
        if (device.gatt?.connected) {
            device.gatt.disconnect()
        }
        abortController.signal.removeEventListener('abort', onAbort)
    }

    abortController.signal.addEventListener('abort', onAbort)

    return {
        label: device.name || dev.label || 'BLE Device',
        abortController,
        readable,
        writable,
    }
}
