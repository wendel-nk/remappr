// pattern-check: skip — rewrite of existing adapter file, follows established electron/serial.ts pattern
/**
 * Electron BLE transport adapter.
 *
 * Coordinates with the main process to discover BLE devices, then uses
 * Electron's built-in Web Bluetooth API (Chromium) for GATT operations.
 *
 * Device discovery flow:
 * 1. list_devices() tells main process to start collecting devices
 * 2. Calls navigator.bluetooth.requestDevice() which triggers Chromium's BLE scan
 * 3. Main process receives 'select-bluetooth-device' events and forwards device
 *    lists to the renderer via IPC
 * 4. list_devices() collects discovered devices and returns them
 *
 * Connection flow:
 * 1. connect(device) tells main process to select the chosen device
 * 2. Main process calls the pending callback, resolving requestDevice()
 * 3. GATT connection, service discovery, and characteristic operations proceed
 *    in the renderer via Web Bluetooth
 */

import { IpcChannels, IpcEvents } from '../../../shared/ipc-types'
import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import type { AvailableDevice } from '../transport/types'

// ZMK Studio BLE service/characteristic UUIDs
const ZMK_SERVICE_UUID = '00000000-0196-6107-c967-c5cfb1c2482a'
const ZMK_CHARACTERISTIC_UUID = '00000001-0196-6107-c967-c5cfb1c2482a'

/** Holds the pending requestDevice() promise between list_devices() and connect() */
let pendingDevicePromise: Promise<BluetoothDevice> | null = null

/** Duration to collect BLE device discoveries before returning the list (ms) */
const SCAN_COLLECTION_MS = 5000

/**
 * Scan for available BLE devices matching the ZMK Studio service.
 *
 * Initiates a Web Bluetooth scan and collects devices reported by the main
 * process. The scan runs for SCAN_COLLECTION_MS before returning results.
 * The pending requestDevice() promise is kept alive for connect() to resolve.
 */
export async function list_devices(): Promise<AvailableDevice[]> {
    if (!navigator.bluetooth) {
        return []
    }

    // Cancel any previous pending scan
    if (pendingDevicePromise) {
        await window.api.invoke(IpcChannels.BLE_STOP_SCAN).catch(() => {})
        pendingDevicePromise = null
    }

    // Tell main process to enter scan/collection mode
    await window.api.invoke(IpcChannels.BLE_START_SCAN)

    // Start the Web Bluetooth scan — this triggers select-bluetooth-device
    // events in the main process. Don't await; it resolves when a device is selected.
    pendingDevicePromise = navigator.bluetooth.requestDevice({
        filters: [{ services: [ZMK_SERVICE_UUID] }],
    })

    // Handle the case where requestDevice rejects (user cancels, etc.)
    pendingDevicePromise.catch(() => {
        pendingDevicePromise = null
    })

    return new Promise<AvailableDevice[]>((resolve) => {
        let latestDevices: AvailableDevice[] = []

        // Listen for device discovery events from the main process
        const unlisten = window.api.on(
            IpcEvents.BLE_DEVICES_DISCOVERED,
            (...args: unknown[]) => {
                latestDevices = args[0] as AvailableDevice[]
            },
        )

        // Return collected devices after the scan period
        setTimeout(() => {
            unlisten()
            resolve(latestDevices)
        }, SCAN_COLLECTION_MS)
    })
}

/**
 * Connect to a specific BLE device and return an RpcTransport.
 *
 * Tells the main process to select the device (resolving the pending
 * requestDevice()), then performs GATT service discovery and sets up
 * read/write streams over the ZMK Studio characteristic.
 */
export async function connect(dev: AvailableDevice): Promise<RpcTransport> {
    if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth API not available in this Electron build')
    }

    // Tell the main process to select this device, resolving requestDevice()
    const selected = await window.api.invoke(
        IpcChannels.BLE_SELECT_DEVICE,
        dev.id,
    )
    if (!selected) {
        throw new Error('Failed to select BLE device')
    }

    // Await the pending requestDevice() promise
    if (!pendingDevicePromise) {
        throw new Error('No pending BLE scan — call list_devices() first')
    }

    const device = await pendingDevicePromise
    pendingDevicePromise = null

    if (!device.gatt) {
        throw new Error('GATT not available on selected device')
    }

    // Connect to GATT server
    const server = await device.gatt.connect()

    // Discover the ZMK Studio service
    const service = await server.getPrimaryService(ZMK_SERVICE_UUID)

    // Get the ZMK Studio characteristic for read/write
    const characteristic = await service.getCharacteristic(
        ZMK_CHARACTERISTIC_UUID,
    )

    // Start notifications for incoming data
    await characteristic.startNotifications()

    const abortController = new AbortController()

    // Set up readable stream from characteristic notifications
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

    // Set up writable stream for sending data to characteristic
    const writable = new WritableStream<Uint8Array>({
        async write(chunk) {
            await characteristic.writeValueWithoutResponse(
                new Uint8Array(chunk),
            )
        },
    })

    // Handle device disconnection
    const onDisconnected = (): void => {
        cleanup()
        responseWritable.close().catch(() => {
            // Stream may already be closed
        })
    }

    device.addEventListener('gattserverdisconnected', onDisconnected)

    // Cleanup function
    const cleanup = (): void => {
        characteristic.removeEventListener(
            'characteristicvaluechanged',
            onCharacteristicChanged,
        )
        device.removeEventListener(
            'gattserverdisconnected',
            onDisconnected,
        )
    }

    // Handle abort (user-initiated disconnect)
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
