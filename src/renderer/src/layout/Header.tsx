// Pattern check: Observer (Tier 1) — extended — uses service.onPendingChangesChanged Observer instead of pub-sub bridge.
// pattern-check: skip — drop dead lock guards now that App-shell render-gates locked state
/* eslint-disable react-hooks/preserve-manual-memoization */
import { useCallback, useEffect, useState } from 'react'
import {
    Lightbulb,
    Redo2,
    Save,
    Sliders,
    Sparkles,
    Trash2,
    Undo2,
    Wifi,
} from 'lucide-react'
import { DynamicEntriesModal } from '@/features/dynamic/DynamicEntriesModal'
import { MacroEditorModal } from '@/features/dynamic/MacroEditorModal'
import { WirelessSettingsModal } from '@/features/firmware/WirelessSettingsModal'
import { RgbSettingsModal } from '@/features/firmware/RgbSettingsModal'
import { GitHubIcon } from '@/components/GitHubIcon'
import { REPO_URL } from '@/lib/constants'
import useConnectionStore from '@/stores/connectionStore'
import undoRedoStore from '@/stores/undoRedoStore'
import { Settings } from '../components/modals/Settings.tsx'
import { Download as DownloadModal } from '../components/modals/Download.tsx'
import { SidebarTrigger } from '@/ui/sidebar'
import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { FeatureGate } from '@/features/firmware/FeatureGate'
import { LayoutSideloadAction } from '@/features/firmware/LayoutSideloadAction'

// pattern-check: skip — wrap toolbar buttons in capability gate, no abstraction
export function Header(): JSX.Element {
    const { service, setService, communication } = useConnectionStore()
    const { undo, redo, canUndo, canRedo, reset } = undoRedoStore()

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
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
                <SidebarTrigger className="-ml-1" />
                <Separator
                    orientation="vertical"
                    className="mx-2 data-[orientation=vertical]:h-4"
                />
                <img
                    src="/remappr.webp"
                    alt="Remappr Logo"
                    className="h-8 rounded ps-3"
                />{' '}
                <span className="px-3">Remappr</span>
                <div className="ml-auto flex items-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <DownloadModal />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Download Config</p>
                        </TooltipContent>
                    </Tooltip>
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
                    <Separator
                        orientation="vertical"
                        className="mx-0.5 data-[orientation=vertical]:h-5"
                    />
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
                                <p>RGB</p>
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
                    {/*<ZmkComboSideloadAction />*/}
                    <Separator
                        orientation="vertical"
                        className="mx-0.5 data-[orientation=vertical]:h-5"
                    />
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
                    <Separator
                        orientation="vertical"
                        className="mx-0.5 data-[orientation=vertical]:h-5"
                    />
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
                    <Separator
                        orientation="vertical"
                        className="mx-0.5 data-[orientation=vertical]:h-5"
                    />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={!unsaved || !service}
                                    onClick={save}
                                >
                                    <Save aria-label="Save" />
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Save</p>
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
                            <p>Discard</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </header>
    )
}
