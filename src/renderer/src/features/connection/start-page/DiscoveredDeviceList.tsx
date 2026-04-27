// pattern-check: skip — prop plumbing only
import { DeviceCard } from '@/features/connection/DeviceCard'
import type { DeviceWithTransport } from '@/hooks/use-transport-discovery'
import { setUserDeviceName } from '@/transport/web-serial'

interface DiscoveredDeviceListProps {
    devices: DeviceWithTransport[]
    connectingDeviceId: string | null
    refreshing?: boolean
    onConnect: (d: DeviceWithTransport) => void
    onRefresh?: () => void
}

export function DiscoveredDeviceList({
    devices,
    connectingDeviceId,
    refreshing = false,
    onConnect,
    onRefresh,
}: DiscoveredDeviceListProps): JSX.Element {
    return (
        <div className="space-y-3">
            {devices.map((d) => {
                const isWebSerial = d.device.id.startsWith('web-serial:')
                const canRename =
                    isWebSerial && d.transport.communication === 'serial'
                return (
                    <DeviceCard
                        key={d.device.id}
                        name={d.device.label}
                        status={d.status}
                        isWireless={d.transport.isWireless}
                        onConnect={() => onConnect(d)}
                        disabled={
                            refreshing ||
                            (connectingDeviceId !== null &&
                                connectingDeviceId !== d.device.id)
                        }
                        canRename={canRename}
                        onRename={
                            canRename
                                ? (next) => {
                                      setUserDeviceName(d.device.id, next)
                                      onRefresh?.()
                                  }
                                : undefined
                        }
                    />
                )
            })}
        </div>
    )
}
