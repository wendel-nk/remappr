import { TransportEventEmitter, AvailableDevice } from './types'
import { STUDIO_SERVICE_UUID, STUDIO_CHAR_UUID } from '@shared/ble-defaults'

export class GattTransport {
    private device?: BluetoothDevice
    private server?: BluetoothRemoteGATTServer
    private service?: BluetoothRemoteGATTService
    private characteristic?: BluetoothRemoteGATTCharacteristic
    private notifyHandle?: AbortController
    private eventEmitter: TransportEventEmitter

    constructor(eventEmitter: TransportEventEmitter) {
        this.eventEmitter = eventEmitter
    }

    async gattConnect(id: string): Promise<boolean> {
        try {
            if (!navigator.bluetooth) {
                throw new Error(
                    'Web Bluetooth API not supported in this browser',
                )
            }

            // Parse device ID (validate format)
            JSON.parse(id)

            // Request Bluetooth device
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    {
                        services: [STUDIO_SERVICE_UUID],
                    },
                ],
            })

            // Connect to GATT server
            this.server = await this.device.gatt?.connect()
            if (!this.server) {
                throw new Error('Failed to connect to GATT server')
            }

            // Get the service
            this.service =
                await this.server.getPrimaryService(STUDIO_SERVICE_UUID)
            if (!this.service) {
                throw new Error(
                    'Failed to connect: Unable to locate the required studio GATT service',
                )
            }

            // Get the characteristic
            this.characteristic =
                await this.service.getCharacteristic(STUDIO_CHAR_UUID)
            if (!this.characteristic) {
                throw new Error(
                    'Failed to connect: Unable to locate the required studio GATT characteristic',
                )
            }

            // Start notifications
            await this.characteristic.startNotifications()
            this.characteristic.addEventListener(
                'characteristicvaluechanged',
                (event) => {
                    const target =
                        event.target as BluetoothRemoteGATTCharacteristic
                    const value = target?.value
                    if (value) {
                        this.eventEmitter.emit(
                            'connection_data',
                            Array.from(new Uint8Array(value.buffer)),
                        )
                    }
                },
            )

            // Monitor disconnection
            this.device.addEventListener('gattserverdisconnected', () => {
                this.eventEmitter.emit('connection_disconnected', null)
            })

            // Create write stream
            const { readable } = new TransformStream<Uint8Array>()

            // Start read/write process
            this.startWriteProcess(readable)

            return true
        } catch (error) {
            throw new Error(`GATT connection failed: ${error}`)
        }
    }

    private async startWriteProcess(
        readable: ReadableStream<Uint8Array>,
    ): Promise<void> {
        const reader = readable.getReader()
        try {
            while (!this.notifyHandle?.signal.aborted) {
                const { value, done } = await reader.read()
                if (done) break

                if (value && this.characteristic) {
                    await this.writeToCharacteristic(value)
                }
            }
        } catch (error) {
            console.error('Write process error:', error)
        } finally {
            reader.releaseLock()
        }
    }

    private async writeToCharacteristic(data: Uint8Array): Promise<void> {
        if (this.characteristic) {
            await this.characteristic.writeValue(
                new Uint8Array(data) as BufferSource,
            )
        }
    }

    async gattListDevices(): Promise<AvailableDevice[]> {
        try {
            if (!navigator.bluetooth) {
                return []
            }

            // Web Bluetooth API doesn't provide a way to list devices without user interaction
            // So we return an empty array and let the user select manually
            return []
        } catch (error) {
            console.error('Failed to list GATT devices:', error)
            return []
        }
    }

    async gattDisconnect(): Promise<void> {
        if (this.device?.gatt?.connected) {
            this.device.gatt.disconnect()
        }

        this.device = undefined
        this.eventEmitter.emit('connection_disconnected', [])
    }
}
