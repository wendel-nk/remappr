import { useState } from 'react'
import { Keyboard } from 'lucide-react'
import { toast } from 'sonner'
import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'

import { Button } from '@/ui/button'
import { Card, CardContent } from '@/ui/card'
import { ExternalLink } from '@/components/ExternalLink'
import { LicenseNoticeModal } from '@/components/modals/LicenseNoticeModal'
import {
    useTransportDiscovery,
    type DeviceWithTransport,
} from '@/hooks/use-transport-discovery'
import { useDeviceConnection } from '@/hooks/use-device-connection'

import { ConnectionStatusBanner } from './ConnectionStatusBanner'
import { TransportSection } from './TransportSection'

interface StartPageProps {
    onTransportCreated: (
        t: RpcTransport,
        communication: 'serial' | 'ble',
    ) => void
}

export function StartPage({ onTransportCreated }: StartPageProps): JSX.Element {
    const [devices, setDevices] = useState<DeviceWithTransport[]>([])

    const {
        connectingDeviceId,
        handleConnect,
        handleSimpleConnect,
        handleRequestNew,
    } = useDeviceConnection(onTransportCreated, setDevices)

    const {
        transports,
        haveTransports,
        hasListableTransports,
        hasSimpleConnectOnly,
        refreshing,
        refresh,
    } = useTransportDiscovery(setDevices, connectingDeviceId)

    if (!haveTransports) {
        return <ConnectionStatusBanner />
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <header className="border-b">
                <div className="container mx-auto flex h-16 items-center px-4">
                    <div className="flex items-center gap-2">
                        <Keyboard className="h-6 w-6 text-primary" />
                        <span className="text-xl font-semibold">Remappr</span>
                    </div>
                </div>
            </header>

            <main className="flex-1">
                <div className="container mx-auto max-w-3xl px-4 py-12">
                    <div className="mb-12 text-center">
                        <h1 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
                            Configure Your Keyboard
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            Connect your ZMK-powered keyboard to customize
                            keymaps and settings.
                        </p>
                    </div>

                    <TransportSection
                        transports={transports}
                        devices={devices}
                        hasListableTransports={hasListableTransports}
                        hasSimpleConnectOnly={hasSimpleConnectOnly}
                        refreshing={refreshing}
                        connectingDeviceId={connectingDeviceId}
                        onRefresh={refresh}
                        onConnect={handleConnect}
                        onSimpleConnect={handleSimpleConnect}
                        onRequestNew={handleRequestNew}
                    />

                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-8 text-center sm:flex-row sm:justify-between sm:text-left">
                            <div className="mb-4 sm:mb-0">
                                <h3 className="font-semibold">Try Demo Mode</h3>
                                <p className="text-sm text-muted-foreground">
                                    Explore Remappr with a simulated keyboard -
                                    no device required.
                                </p>
                            </div>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    toast.info('Demo mode coming soon!', {
                                        description:
                                            'This feature is currently under development.',
                                    })
                                }}
                            >
                                Try Demo
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </main>

            <footer className="border-t py-6">
                <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
                    <p>
                        <span>
                            &copy; {new Date().getFullYear()} - Remappr
                            Contributors
                        </span>
                        {' - '}
                        Powered by{' '}
                        <ExternalLink href="https://zmk.dev">
                            ZMK Firmware
                        </ExternalLink>
                        {' - '}
                        <LicenseNoticeModal></LicenseNoticeModal>
                    </p>
                </div>
            </footer>
        </div>
    )
}
