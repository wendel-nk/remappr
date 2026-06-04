// pattern-check: skip — UI shell, restyled to the design prototype; delegates to useConnection
import { BookOpen, Download, Keyboard, Sparkles } from 'lucide-react'
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
        <div className="workbench-bg flex h-full flex-col overflow-auto bg-background">
            {/* top hairline */}
            <div
                className="h-[3px] shrink-0"
                style={{
                    background:
                        'linear-gradient(90deg, transparent, color-mix(in oklch, var(--primary) 70%, transparent), transparent)',
                }}
            />

            {/* header */}
            <header className="relative z-[2] flex items-center justify-between px-7 py-5">
                <div className="flex items-center gap-3">
                    <span
                        className="grid size-[38px] place-items-center rounded-xl text-white"
                        style={{
                            background:
                                'linear-gradient(150deg, var(--primary), color-mix(in oklch, var(--primary) 70%, #000))',
                        }}
                    >
                        <Keyboard size={22} />
                    </span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-[21px] font-extrabold tracking-tight">
                            Remappr
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                            v{APP_VERSION}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
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
            </header>

            {/* hero + content */}
            <main className="relative z-[1] flex flex-1 flex-col items-center px-6 pb-16 pt-8">
                <div className="fade-in mb-9 max-w-[560px] text-center">
                    <div
                        className="mb-5 inline-flex items-center gap-[7px] rounded-full border px-3 py-[5px] text-[12px] font-semibold text-primary"
                        style={{
                            background:
                                'color-mix(in oklch, var(--primary) 14%, transparent)',
                            borderColor:
                                'color-mix(in oklch, var(--primary) 30%, transparent)',
                        }}
                    >
                        <span className="size-[7px] rounded-full bg-primary" />
                        QMK · VIA · ZMK compatible
                    </div>
                    <h1 className="mb-3 text-[40px] font-extrabold leading-[1.05] tracking-tight">
                        Configure Your Keyboard
                    </h1>
                    <p className="text-[16px] leading-normal text-muted-foreground">
                        Connect your keyboard to customize keymaps and settings.
                    </p>
                </div>

                <div className="fade-in w-full max-w-[720px]">
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

                    <BuilderCard />

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <FeatureCard
                            icon={Sparkles}
                            title="Try Demo Mode"
                            description="Explore Remappr with a simulated keyboard — no device required."
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
                        <FeatureCard
                            icon={Download}
                            title="Get the desktop app"
                            description="Download the latest Remappr build for your operating system."
                            action={<DownloadLatestButton />}
                        />
                    </div>
                </div>
            </main>

            <footer className="border-t border-border py-5 text-center text-[12.5px] text-muted-foreground">
                <span>
                    &copy; {new Date().getFullYear()} — Remappr Contributors
                </span>
                {' · '}
                <LicenseNoticeModal />
            </footer>
        </div>
    )
}
