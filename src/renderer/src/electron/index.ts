export type { AvailableDevice } from '../transport/types'
export {
    list_devices as list_serial_devices,
    connect as connect_serial,
    disconnect as disconnect_serial,
} from './serial'
// pattern-check: skip — barrel file, adding BLE list_devices export
export {
    connect as connect_ble,
    list_devices as list_ble_devices,
} from './ble'

// Disconnect for serial connections.
// BLE disconnect is handled via the AbortController on the RpcTransport.
export async function disconnect(): Promise<void> {
    try {
        await import('./serial').then(
            (m: { disconnect: () => Promise<void> }): Promise<void> =>
                m.disconnect(),
        )
    } catch (error) {
        console.warn('Error during disconnect:', error)
    }
}
