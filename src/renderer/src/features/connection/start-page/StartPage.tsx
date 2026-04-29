import { useState } from 'react'
import { Keyboard } from 'lucide-react'
import { toast } from 'sonner'
import type { Transport } from '@firmware'

import { Button } from '@/ui/button'
import { Card, CardContent } from '@/ui/card'
import { ExternalLink } from '@/components/ExternalLink'
import { GitHubIcon } from '@/components/GitHubIcon'
import { DownloadLatestButton } from '@/components/DownloadLatestButton'
import { APP_VERSION, REPO_URL } from '@/lib/constants'
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
        t: Transport,
        communication: 'serial' | 'ble' | 'hid',
    ) => void
    onDemoConnect?: () => void | Promise<void>
}

export function StartPage({
    onTransportCreated,
    onDemoConnect,
}: StartPageProps): JSX.Element {
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
        <div className="flex h-full flex-col overflow-auto bg-background">
            <header className="border-b">
                <div className="container mx-auto flex h-16 items-center px-4">
                    <div className="flex items-center gap-2">
                        <Keyboard className="h-6 w-6 text-primary" />
                        <span className="text-xl font-semibold">Remappr</span>
                        <span className="text-xs text-muted-foreground">
                            v{APP_VERSION}
                        </span>
                    </div>
                    <a
                        href={REPO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View source on GitHub"
                        className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                        <GitHubIcon className="h-5 w-5" />
                    </a>
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

                    <div className="mt-6 grid gap-6 md:grid-cols-2">
                        <Card className="border-dashed">
                            <CardContent className="flex h-full flex-col items-center justify-between gap-4 py-8 text-center">
                                <div>
                                    <h3 className="font-semibold">
                                        Try Demo Mode
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Explore Remappr with a simulated
                                        keyboard - no device required.
                                    </p>
                                </div>
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        if (onDemoConnect) {
                                            void onDemoConnect()
                                            return
                                        }
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

                        <Card className="border-dashed">
                            <CardContent className="flex h-full flex-col items-center justify-between gap-4 py-8 text-center">
                                <div>
                                    <h3 className="font-semibold">
                                        Get the desktop app
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Download the latest Remappr build for
                                        your operating system.
                                    </p>
                                </div>
                                <DownloadLatestButton />
                            </CardContent>
                        </Card>
                    </div>
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
