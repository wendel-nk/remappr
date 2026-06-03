// pattern-check: skip — UI shell, drops local devices state, delegates to useConnection
import { BookOpen, Keyboard } from 'lucide-react'
import { toast } from 'sonner'
import type { Transport } from '@firmware'

import { Button } from '@/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { GitHubIcon } from '@/components/GitHubIcon'
import { DiscordIcon } from '@/components/DiscordIcon'
import { DownloadLatestButton } from '@/components/DownloadLatestButton'
import { APP_VERSION, DISCORD_URL, REPO_URL } from '@/lib/constants'
import { LicenseNoticeModal } from '@/components/modals/LicenseNoticeModal'
import { Settings } from '@/components/modals/Settings'
import { useConnection } from '@/hooks/use-connection'

import { ConnectionStatusBanner } from './ConnectionStatusBanner'
import { ConfigReadyBanner } from './ConfigReadyBanner'
import { TransportSection } from './TransportSection'
import { FeatureCard } from './FeatureCard'
import { BuilderCard } from './BuilderCard'

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
                    <div className="ml-auto flex items-center gap-1">
                        <Settings />
                        <a
                            href={REPO_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="View source on GitHub"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                            <GitHubIcon className="h-5 w-5" />
                        </a>
                        <a
                            href={DISCORD_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Join the Discord community"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                            <DiscordIcon className="h-5 w-5" />
                        </a>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground/50">
                                    <BookOpen className="h-5 w-5" />
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Documentation — coming soon</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </header>

            <main className="flex-1">
                <div className="container mx-auto max-w-3xl px-4 py-12">
                    <div className="mb-12 text-center">
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            QMK · VIA · ZMK compatible
                        </div>
                        <h1 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
                            Configure Your Keyboard
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            Connect your keyboard to customize keymaps and
                            settings.
                        </p>
                    </div>

                    <ConfigReadyBanner />

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

                    <div className="mt-6 grid gap-6 md:grid-cols-3">
                        <FeatureCard
                            title="Try Demo Mode"
                            description="Explore Remappr with a simulated keyboard - no device required."
                            action={
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
                            }
                        />
                        <BuilderCard />
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
                        <LicenseNoticeModal></LicenseNoticeModal>
                    </p>
                </div>
            </footer>
        </div>
    )
}
