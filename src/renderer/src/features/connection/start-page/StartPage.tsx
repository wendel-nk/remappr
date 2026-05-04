// pattern-check: skip — UI shell consuming useConnection
import { Keyboard } from 'lucide-react'
import { toast } from 'sonner'
import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'

import { Button } from '@/ui/button'
import { ExternalLink } from '@/components/ExternalLink'
import { GitHubIcon } from '@/components/GitHubIcon'
import { DownloadLatestButton } from '@/components/DownloadLatestButton'
import { APP_VERSION, REPO_URL } from '@/lib/constants'
import { LicenseNoticeModal } from '@/components/modals/LicenseNoticeModal'
import { useConnection } from '@/hooks/use-connection'

import { ConnectionStatusBanner } from './ConnectionStatusBanner'
import { TransportSection } from './TransportSection'
import { FeatureCard } from './FeatureCard'

interface StartPageProps {
    onTransportCreated: (
        t: RpcTransport,
        communication: 'serial' | 'ble',
    ) => void
}

export function StartPage({ onTransportCreated }: StartPageProps): JSX.Element {
    const {
        transports,
        haveTransports,
        hasListableTransports,
        hasSimpleConnectOnly,
        devices,
        connectingDeviceId,
        refreshing,
        refresh,
        connect,
        simpleConnect,
        requestNew,
    } = useConnection(onTransportCreated)

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
                        onConnect={connect}
                        onSimpleConnect={simpleConnect}
                        onRequestNew={requestNew}
                    />

                    <div className="mt-6 grid gap-6 md:grid-cols-2">
                        <FeatureCard
                            title="Try Demo Mode"
                            description="Explore Remappr with a simulated keyboard - no device required."
                            action={
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
                            }
                        />
                        <FeatureCard
                            title="Get the desktop app"
                            description="Download the latest Remappr build for your operating system."
                            action={<DownloadLatestButton />}
                        />
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
