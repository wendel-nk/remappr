import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import type { AvailableDevice } from '../transport/types'

// ZMK Studio GATT Service UUID
const ZMK_STUDIO_SERVICE_UUID = '00000000-0196-6107-c967-c5cfb1c2482a'
const ZMK_STUDIO_CHARACTERISTIC_UUID = '00000001-0196-6107-c967-c5cfb1c2482a'

// Store connected device state
let connectedDevice: BluetoothDevice | undefined
let connectedCharacteristic: BluetoothRemoteGATTCharacteristic | undefined

/**
 * Check if running in Electron environment
 */
export function isElectron(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.api !== 'undefined' &&
        typeof window.api.ble !== 'undefined'
    )
}

/**
 * List available BLE devices
 * In Electron, this triggers the device picker flow
 */
export async function list_devices(): Promise<Array<AvailableDevice>> {
    if (!isElectron()) {
        console.warn('Not running in Electron environment')
        return []
    }

    // Check if Web Bluetooth is available
    if (!navigator.bluetooth) {
        console.warn('Web Bluetooth API not available')
        return []
    }

    // Return an empty list - actual device selection happens during connect
    // This is because Web Bluetooth requires user gesture for device selection
    return []
}

/**
 * Connect to a BLE device
 * This uses Web Bluetooth API with Electron's device selection handler
 */
export async function connect(): Promise<RpcTransport> {
    if (!isElectron()) {
        throw new Error('Not running in Electron environment')
    }

    if (!navigator.bluetooth) {
        throw new Error('Web Bluetooth API not available')
    }

    try {
        // Request a Bluetooth device with the ZMK Studio service filter
        const device = await navigator.bluetooth.requestDevice({
            filters: [
                {
                    services: [ZMK_STUDIO_SERVICE_UUID],
                },
            ],
            optionalServices: [ZMK_STUDIO_SERVICE_UUID],
        })

        if (!device) {
            throw new Error('No device selected')
        }

        connectedDevice = device

        // Connect to GATT server
        const server = await device.gatt?.connect()
        if (!server) {
            throw new Error('Failed to connect to GATT server')
        }

        // Get the ZMK Studio service
        const service = await server.getPrimaryService(ZMK_STUDIO_SERVICE_UUID)
        if (!service) {
            throw new Error(
                'Failed to find ZMK Studio service. Make sure the keyboard firmware supports ZMK Studio.',
            )
        }

        // Get the characteristic for RPC communication
        const characteristic = await service.getCharacteristic(
            ZMK_STUDIO_CHARACTERISTIC_UUID,
        )
        if (!characteristic) {
            throw new Error('Failed to find ZMK Studio characteristic')
        }

        connectedCharacteristic = characteristic

        // Notify main process that we're connected
        await window.api.ble.setConnected(true)

        // Start notifications for receiving data
        await characteristic.startNotifications()

        // Create abort controller for cleanup
        const abortController = new AbortController()

        // Create transform stream for responses
        const { writable: responseWritable, readable } =
            new TransformStream<Uint8Array>()

        // Handle incoming data via notifications
        const handleNotification = (event: Event): void => {
            const target = event.target as BluetoothRemoteGATTCharacteristic
            const value = target?.value
            if (value) {
                const data = new Uint8Array(value.buffer)
                const writer = responseWritable.getWriter()
                writer.write(data).then(() => writer.releaseLock())
            }
        }

        characteristic.addEventListener(
            'characteristicvaluechanged',
            handleNotification,
        )

        // Handle disconnection
        const handleDisconnect = async (): Promise<void> => {
            characteristic.removeEventListener(
                'characteristicvaluechanged',
                handleNotification,
            )
            device.removeEventListener(
                'gattserverdisconnected',
                handleDisconnect,
            )
            await window.api.ble.setConnected(false)
            try {
                await responseWritable.close()
            } catch {
                // Ignore errors when closing
            }
            connectedDevice = undefined
            connectedCharacteristic = undefined
        }

        device.addEventListener('gattserverdisconnected', handleDisconnect)

        // Create writable stream for sending data
        const writable = new WritableStream<Uint8Array>({
            async write(chunk) {
                if (connectedCharacteristic) {
                    await connectedCharacteristic.writeValue(
                        new Uint8Array(chunk) as BufferSource,
                    )
                }
            },
        })

        // Handle abort signal
        const signal = abortController.signal
        const abortHandler = async (): Promise<void> => {
            signal.removeEventListener('abort', abortHandler)
            await disconnect()
        }
        signal.addEventListener('abort', abortHandler)

        return {
            label: device.name || 'BLE Device',
            abortController,
            readable,
            writable,
        }
    } catch (error) {
        await window.api.ble.setConnected(false)
        throw new Error(`BLE connection failed: ${error}`)
    }
}

/**
 * Disconnect from the current BLE device
 */
export async function disconnect(): Promise<void> {
    if (connectedDevice?.gatt?.connected) {
        connectedDevice.gatt.disconnect()
    }

    connectedDevice = undefined
    connectedCharacteristic = undefined

    if (isElectron()) {
        await window.api.ble.setConnected(false)
    }
}
