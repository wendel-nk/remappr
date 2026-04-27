import { DeviceCard } from '@/features/connection/DeviceCard'
import type { DeviceWithTransport } from '@/hooks/use-transport-discovery'

interface DiscoveredDeviceListProps {
    devices: DeviceWithTransport[]
    connectingDeviceId: string | null
    onConnect: (d: DeviceWithTransport) => void
}

export function DiscoveredDeviceList({
    devices,
    connectingDeviceId,
    onConnect,
}: DiscoveredDeviceListProps): JSX.Element {
    return (
        <div className="space-y-3">
            {devices.map((d) => (
                <DeviceCard
                    key={d.device.id}
                    name={d.device.label}
                    status={d.status}
                    isWireless={d.transport.isWireless}
                    onConnect={() => onConnect(d)}
                    disabled={
                        connectingDeviceId !== null &&
                        connectingDeviceId !== d.device.id
                    }
                />
            ))}
        </div>
    )
}
