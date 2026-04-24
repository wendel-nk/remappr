/**
 * Electron BLE transport adapter.
 *
 * Uses Electron's built-in Web Bluetooth support (Chromium Web Bluetooth API)
 * for BLE device scanning, connection, and GATT operations.
 *
 * The main process handles the 'select-bluetooth-device' event to coordinate
 * device selection. All GATT operations (service discovery, characteristic
 * read/write, notifications) happen directly in the renderer via Web Bluetooth.
 */

import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'

// ZMK Studio BLE service/characteristic UUIDs
const ZMK_SERVICE_UUID = '00000000-0196-6107-c967-c5cfb1c2482a'
const ZMK_CHARACTERISTIC_UUID = '00000001-0196-6107-c967-c5cfb1c2482a'

/**
 * Connect to a ZMK keyboard via BLE using Web Bluetooth.
 *
 * Flow:
 * 1. Call navigator.bluetooth.requestDevice() with ZMK service filter
 * 2. Electron main process handles device selection via select-bluetooth-device event
 * 3. Connect to GATT server
 * 4. Discover ZMK Studio service and characteristic
 * 5. Start notifications for incoming data
 * 6. Return RpcTransport with readable/writable streams
 */
export async function connect(): Promise<RpcTransport> {
    if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth API not available in this Electron build')
    }

    // Request a BLE device matching the ZMK Studio service.
    // Electron's main process handles device selection via 'select-bluetooth-device' event.
    const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [ZMK_SERVICE_UUID] }],
    })

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

    const onCharacteristicChanged = async (
        event: Event,
    ): Promise<void> => {
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
        label: device.name || `BLE Device`,
        abortController,
        readable,
        writable,
    }
}
