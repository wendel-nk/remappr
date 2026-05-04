// pattern-check: skip — type extraction from existing files, no new logic
import type { AvailableDevice, TransportFactory } from '@/transport/types'

export type DeviceStatus = 'available' | 'connecting' | 'connected'

export interface DeviceWithTransport {
    device: AvailableDevice
    transport: TransportFactory
    status: DeviceStatus
}
