// pattern-check: skip — branch extraction from TransportSection
import type {TransportFactory} from '@/transport/types'
import type {DeviceWithTransport} from '@/features/connection/types'
import {DiscoveredDeviceList} from '../DiscoveredDeviceList'
import {PairNewButton} from './PairNewButton'

interface ListedDevicesProps {
    devices: DeviceWithTransport[]
    pairableTransports: TransportFactory[]
    connectingDeviceId: string | null
    refreshing: boolean
    onConnect: ( d: DeviceWithTransport ) => void
    onRefresh: () => void
    onRequestNew: ( t: TransportFactory ) => void
}

export function ListedDevices ( {
    devices,
    pairableTransports,
    connectingDeviceId,
    refreshing,
    onConnect,
    onRefresh,
    onRequestNew,
}: ListedDevicesProps ): JSX.Element {
    return (
        <div className="space-y-3">
            <DiscoveredDeviceList
                devices={devices}
                connectingDeviceId={connectingDeviceId}
                refreshing={refreshing}
                onConnect={onConnect}
                onRefresh={onRefresh}
            />
            {pairableTransports.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                    <PairNewButton
                        transports={pairableTransports}
                        onRequestNew={onRequestNew}
                        variant="outline"
                        size="sm"
                    />
                </div>
            )}
        </div>
    )
}
