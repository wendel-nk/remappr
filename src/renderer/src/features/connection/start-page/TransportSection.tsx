import { RefreshCw, Monitor } from 'lucide-react'
import { Button } from '@/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/ui/card'
import type { TransportFactory } from '@/transport/types'
import type { DeviceWithTransport } from '@/hooks/use-transport-discovery'
import { DiscoveredDeviceList } from './DiscoveredDeviceList'

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
}: TransportSectionProps): JSX.Element {
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
                    <div className="grid gap-3 sm:grid-cols-2">
                        {transports.map((t) => (
                            <Button
                                key={t.label}
                                variant="outline"
                                className="h-auto flex-col gap-2 py-6"
                                onClick={() => onSimpleConnect(t)}
                            >
                                {t.isWireless ? (
                                    <span className="text-blue-500">
                                        Bluetooth
                                    </span>
                                ) : (
                                    <span>USB</span>
                                )}
                                <span className="text-sm text-muted-foreground">
                                    Connect via {t.label}
                                </span>
                            </Button>
                        ))}
                    </div>
                ) : hasListableTransports && devices.length > 0 ? (
                    <DiscoveredDeviceList
                        devices={devices}
                        connectingDeviceId={connectingDeviceId}
                        onConnect={onConnect}
                    />
                ) : hasListableTransports ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                            <Monitor className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="mb-2 font-semibold">No Devices Found</h3>
                        <p className="mb-4 max-w-sm text-sm text-muted-foreground">
                            Make sure your keyboard is connected and ZMK Studio
                            is enabled in your firmware.
                        </p>
                        <Button
                            variant="outline"
                            onClick={onRefresh}
                            disabled={refreshing}
                        >
                            <RefreshCw
                                className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                            />
                            Scan for Devices
                        </Button>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    )
}
