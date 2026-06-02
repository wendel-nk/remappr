// Pattern check: Observer (Tier 1) — extended — uses service.onPendingChangesChanged Observer instead of pub-sub bridge.
// pattern-check: skip — toolbar JSX rebuild to the redesign spec; no new abstraction
/* eslint-disable react-hooks/preserve-manual-memoization */
import { useCallback, useEffect, useState } from 'react'
import {
    BarChart3,
    BookOpen,
    Flame,
    Keyboard,
    Lightbulb,
    Redo2,
    Save,
    Sliders,
    Sparkles,
    Trash2,
    Undo2,
    Wifi,
    Zap,
} from 'lucide-react'
import { LoadStatsModal } from '@/features/keymap/keyboard/LoadStatsModal'
import { DynamicEntriesModal } from '@/features/dynamic/DynamicEntriesModal'
import { MacroEditorModal } from '@/features/dynamic/MacroEditorModal'
import { WirelessSettingsModal } from '@/features/firmware/WirelessSettingsModal'
import { RgbSettingsModal } from '@/features/firmware/RgbSettingsModal'
import { GitHubIcon } from '@/components/GitHubIcon'
import { DiscordIcon } from '@/components/DiscordIcon'
import { DISCORD_URL, REPO_URL } from '@/lib/constants'
import useConnectionStore from '@/stores/connectionStore'
import undoRedoStore from '@/stores/undoRedoStore'
import useHeatmapStore from '@/stores/heatmapStore'
import useLiveViewStore from '@/stores/liveViewStore'
import useLoadStatsStore from '@/stores/loadStatsStore'
import { Settings } from '../components/modals/Settings.tsx'
import { Download as DownloadModal } from '../components/modals/Download.tsx'
import { SidebarTrigger } from '@/ui/sidebar'
import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { FeatureGate } from '@/features/firmware/FeatureGate'
import { LayoutSideloadAction } from '@/features/firmware/LayoutSideloadAction'
import { WindowControls } from '@/layout/WindowControls'

const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

// pattern-check: skip — wrap toolbar buttons in capability gate, no abstraction
export function Header(): JSX.Element {
    const { service, setService, communication, disconnect } =
        useConnectionStore()
    const { undo, redo, canUndo, canRedo, reset } = undoRedoStore()

    const heatmapOn = useHeatmapStore((s) => s.enabled)
    const toggleHeatmap = useHeatmapStore((s) => s.toggle)
    const liveOn = useLiveViewStore((s) => s.enabled)
    const toggleLive = useLiveViewStore((s) => s.toggle)
    const loadOpen = useLoadStatsStore((s) => s.open)
    const setLoadOpen = useLoadStatsStore((s) => s.setOpen)

    const [unsaved, setUnsaved] = useState<boolean>(false)
    const [dynOpen, setDynOpen] = useState(false)
    const [macroOpen, setMacroOpen] = useState(false)
    const [wirelessOpen, setWirelessOpen] = useState(false)
    const [rgbOpen, setRgbOpen] = useState(false)

    useEffect(() => {
        if (!service) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setUnsaved(false)
            return
        }
        let cancelled = false
        ;(async () => {
            try {
                const pending = await service.refreshPendingChanges()
                if (!cancelled) setUnsaved(pending)
            } catch (e) {
                console.error('Failed to refresh pending changes', e)
            }
        })()
        const off = service.onPendingChangesChanged((pending) => {
            setUnsaved(pending)
        })
        return (): void => {
            cancelled = true
            off()
        }
    }, [service])

    const save = useCallback(async (): Promise<void> => {
        if (!service) return
        try {
            await service.commit()
        } catch (e) {
            console.error('Failed to save changes', e)
            toast.error(`Failed to save changes`)
        }
    }, [service])

    const discard = useCallback(async (): Promise<void> => {
        if (!service) return
        try {
            await service.discardChanges()
        } catch (e) {
            console.error('Failed to discard changes', e)
            toast.error(`Failed to discard changes`)
        }

        reset()
        setService(service, communication ?? undefined)
    }, [service, communication, reset, setService])

    return (
        <header
            className="flex h-(--header-height) shrink-0 select-none items-center gap-1 border-b bg-card pl-2 transition-[width,height] ease-linear"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            {/* ===== left: sidebar toggle + brand ===== */}
            <div className="flex items-center gap-1" style={noDrag}>
                <SidebarTrigger />
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            onClick={disconnect}
                            className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-foreground transition-colors hover:bg-accent"
                        >
                            <span className="grid size-7 place-items-center rounded-md bg-[linear-gradient(150deg,var(--primary),color-mix(in_oklch,var(--primary)_65%,#000))] text-white">
                                <Keyboard className="size-4" />
                            </span>
                            <span className="text-[14.5px] font-bold">
                                Remappr
                            </span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Back to devices</p>
                    </TooltipContent>
                </Tooltip>
            </div>

            {/* draggable spacer */}
            <div className="h-full flex-1" />

            {/* ===== right: tool clusters + window controls ===== */}
            <div
                className="flex items-center gap-1 pr-1"
                data-coach="tools"
                style={noDrag}
            >
                {/* view group: heatmap · live · stats */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            data-active={heatmapOn}
                            className="data-[active=true]:bg-primary/20 data-[active=true]:text-primary"
                            onClick={toggleHeatmap}
                        >
                            <Flame aria-label="Heatmap" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Heatmap</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            data-active={liveOn}
                            className="data-[active=true]:bg-primary/20 data-[active=true]:text-primary"
                            onClick={toggleLive}
                        >
                            <Zap aria-label="Live view" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Live view</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={(): void => setLoadOpen(true)}
                        >
                            <BarChart3 aria-label="Typing load" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Typing load stats</p>
                    </TooltipContent>
                </Tooltip>
                <LoadStatsModal
                    opened={loadOpen}
                    onClose={(): void => setLoadOpen(false)}
                />

                <Separator
                    orientation="vertical"
                    className="mx-1 data-[orientation=vertical]:h-5"
                />

                {/* config group: flash · dynamic · macros · wireless · rgb · settings · github */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>
                            <DownloadModal />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Flash &amp; export config</p>
                    </TooltipContent>
                </Tooltip>
                <FeatureGate feature="dynamic">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={!service}
                                onClick={(): void => setDynOpen(true)}
                            >
                                <Sliders aria-label="Dynamic entries" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Dynamic Entries</p>
                        </TooltipContent>
                    </Tooltip>
                </FeatureGate>
                <DynamicEntriesModal
                    service={service}
                    opened={dynOpen}
                    onClose={(): void => setDynOpen(false)}
                />
                <FeatureGate feature="macros">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={!service}
                                onClick={(): void => setMacroOpen(true)}
                            >
                                <Sparkles aria-label="Macros" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Macros</p>
                        </TooltipContent>
                    </Tooltip>
                </FeatureGate>
                <MacroEditorModal
                    service={service}
                    opened={macroOpen}
                    onClose={(): void => setMacroOpen(false)}
                />
                <FeatureGate feature="wireless">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={!service}
                                onClick={(): void => setWirelessOpen(true)}
                            >
                                <Wifi aria-label="Wireless settings" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Wireless</p>
                        </TooltipContent>
                    </Tooltip>
                </FeatureGate>
                <WirelessSettingsModal
                    opened={wirelessOpen}
                    onClose={(): void => setWirelessOpen(false)}
                />
                <FeatureGate feature="rgb">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={!service}
                                onClick={(): void => setRgbOpen(true)}
                            >
                                <Lightbulb aria-label="RGB settings" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>RGB lighting</p>
                        </TooltipContent>
                    </Tooltip>
                </FeatureGate>
                <RgbSettingsModal
                    opened={rgbOpen}
                    onClose={(): void => setRgbOpen(false)}
                />
                <FeatureGate feature="layoutSideloadable">
                    <LayoutSideloadAction />
                </FeatureGate>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>
                            <Settings />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Settings</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" asChild>
                            <a
                                href={REPO_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="View source on GitHub"
                            >
                                <GitHubIcon className="h-4 w-4" />
                            </a>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>GitHub Repository</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" asChild>
                            <a
                                href={DISCORD_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Join the Discord community"
                            >
                                <DiscordIcon className="h-4 w-4" />
                            </a>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Discord Community</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled
                                aria-label="Documentation (coming soon)"
                            >
                                <BookOpen className="h-4 w-4" />
                            </Button>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Documentation — coming soon</p>
                    </TooltipContent>
                </Tooltip>

                <Separator
                    orientation="vertical"
                    className="mx-1 data-[orientation=vertical]:h-5"
                />

                {/* history group: undo · redo · discard · save-pill */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={!canUndo()}
                                onClick={undo}
                            >
                                <Undo2 aria-label="Undo" />
                            </Button>
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Undo</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={!canRedo()}
                                onClick={redo}
                            >
                                <Redo2 aria-label="Redo" />
                            </Button>
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Redo</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={!unsaved}
                                onClick={discard}
                            >
                                <Trash2 aria-label="Discard" />
                            </Button>
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Discard changes</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            disabled={!unsaved || !service}
                            onClick={save}
                            data-dirty={unsaved}
                            className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors data-[dirty=false]:border-border data-[dirty=false]:bg-secondary data-[dirty=false]:text-muted-foreground data-[dirty=true]:border-transparent data-[dirty=true]:bg-primary data-[dirty=true]:text-primary-foreground disabled:cursor-default disabled:opacity-100"
                        >
                            <Save className="size-3.5" />
                            {unsaved ? 'Save' : 'Saved'}
                            {unsaved && (
                                <span className="size-1.5 rounded-full bg-current" />
                            )}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Save keymap to keyboard</p>
                    </TooltipContent>
                </Tooltip>
            </div>

            {/* native window controls (Electron, non-mac) merged into the bar */}
            <WindowControls />
        </header>
    )
}
