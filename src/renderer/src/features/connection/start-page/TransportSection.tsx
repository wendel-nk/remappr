// pattern-check: skip — slim shell that dispatches to one of three branch components
import { RefreshCw } from 'lucide-react'
import { Button } from '@/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/ui/card'
import type { TransportFactory } from '@/transport/types'
import type { DeviceWithTransport } from '@/features/connection/types'
import { SimpleConnectGrid } from './transport-section/SimpleConnectGrid'
import { ListedDevices } from './transport-section/ListedDevices'
import { EmptyState } from './transport-section/EmptyState'

interface TransportSectionProps {
    transports: TransportFactory[]
    devices: DeviceWithTransport[]
    hasListableTransports: boolean
    hasSimpleConnectOnly: boolean
    refreshing: boolean
    connectingDeviceId: string | null
    onRefresh: () => void
    onConnect: (d: DeviceWithTransport) => void
    onSimpleConnect: (t: TransportFactory) => void
    onRequestNew: (t: TransportFactory) => void
}

export function TransportSection({
    transports,
    devices,
    hasListableTransports,
    hasSimpleConnectOnly,
    refreshing,
    connectingDeviceId,
    onRefresh,
    onConnect,
    onSimpleConnect,
    onRequestNew,
}: TransportSectionProps): JSX.Element {
    const pairableTransports = transports.filter((t) => !!t.request_new)

    return (
        <Card className="mb-8">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Available Devices</CardTitle>
                        <CardDescription>
                            {hasSimpleConnectOnly
                                ? 'Select a connection type to connect your device'
                                : 'Select a device to connect'}
                        </CardDescription>
                    </div>
                    {hasListableTransports && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={onRefresh}
                            disabled={refreshing}
                        >
                            <RefreshCw
                                className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                            />
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {hasSimpleConnectOnly ? (
                    <SimpleConnectGrid
                        transports={transports}
                        onSimpleConnect={onSimpleConnect}
                    />
                ) : hasListableTransports && devices.length > 0 ? (
                    <>
                        <ListedDevices
                            devices={devices}
                            pairableTransports={pairableTransports}
                            connectingDeviceId={connectingDeviceId}
                            refreshing={refreshing}
                            onConnect={onConnect}
                            onRefresh={onRefresh}
                            onRequestNew={onRequestNew}
                        />
                        <p className="mt-4 text-center text-xs text-muted-foreground">
                            {devices.length} device
                            {devices.length === 1 ? '' : 's'} found · click a
                            card to open the editor
                        </p>
                    </>
                ) : hasListableTransports ? (
                    <EmptyState
                        pairableTransports={pairableTransports}
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        onRequestNew={onRequestNew}
                    />
                ) : null}
            </CardContent>
        </Card>
    )
}
