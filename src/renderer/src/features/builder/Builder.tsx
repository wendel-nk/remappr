// Pattern check: no GoF pattern (-) — rejected — presentational full-screen shell
// (toolbar / left panel / canvas / right inspector); layout markup, no abstraction.
//
// The full-screen Keyboard Builder shell, ported 1:1 from the design prototype
// (app/builder/Builder.jsx): 52px toolbar, 270px left tools panel, flexible
// pan/zoom canvas, 296px right inspector. Theme-aware by construction — it uses
// the same CSS tokens (var(--primary)/--card/--sidebar/--border/...) the rest of
// the app does, and caps render through the production KeyButton.
//
// This is now a thin composition: the toolbar, left tools panel, right dock, and
// the bottom modal cluster live in sibling files, and the keyboard shortcuts in a
// hook. Builder.tsx owns the store reads + the modal-visibility state and threads
// them down, keeping the canvas body (VariantBar / status bar / BindingPicker)
// inline since it reads the same local wiring.
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import useBuilderStore from '@/stores/builderStore'
import { useBuilderStage } from '@/hooks/use-premium'
import useConfigStore from '@/stores/configStore'
import useConnectionStore from '@/stores/connectionStore'
import { defaultBoardConfig } from './builderPresets'
import { displayMatrixDims } from './builderMatrix'
import { BuilderCanvas } from './BuilderCanvas'
import { BindingPicker } from './BindingPicker'
import {
    setBinding,
    setEncoderBinding,
    setSliderBinding,
} from './builderInspectorOps'
import { VariantBar } from './VariantBar'
import { saveBoard } from './builderLibrary'
import { useBuilderKeyboard } from './useBuilderKeyboard'
import { BuilderToolbar } from './BuilderToolbar'
import { BuilderLeftPanel } from './BuilderLeftPanel'
import { BuilderRightDock } from './BuilderRightDock'
import { BuilderModalsCluster } from './BuilderModalsCluster'

// pattern-check: skip — mechanical rename FullScreenBuilder → Builder, no logic change
export function Builder(): JSX.Element {
    // pattern-check: skip — single hook-read line, no new abstraction
    const stage = useBuilderStage()
    const setOpen = useBuilderStore((s) => s.setOpen)
    const snapMode = useBuilderStore((s) => s.snapMode)
    const setSnapMode = useBuilderStore((s) => s.setSnapMode)
    const snapping = useBuilderStore((s) => s.snapping)
    const toggleSnapping = useBuilderStore((s) => s.toggleSnapping)
    const selection = useBuilderStore((s) => s.selection)
    const matrixView = useBuilderStore((s) => s.matrixView)
    const toggleMatrixView = useBuilderStore((s) => s.toggleMatrixView)
    const leftOpen = useBuilderStore((s) => s.leftOpen)
    const toggleLeft = useBuilderStore((s) => s.toggleLeft)
    const jsonOpen = useBuilderStore((s) => s.jsonOpen)
    const toggleJson = useBuilderStore((s) => s.toggleJson)
    const setJsonOpen = useBuilderStore((s) => s.setJsonOpen)
    const canUndo = useBuilderStore((s) => s.past.length > 0)
    const canRedo = useBuilderStore((s) => s.future.length > 0)
    const undo = useBuilderStore((s) => s.undo)
    const redo = useBuilderStore((s) => s.redo)
    const commit = useBuilderStore((s) => s.commit)
    const config = useConfigStore((s) => s.config)
    const setConfig = useConfigStore((s) => s.setConfig)
    const openInEditor = useBuilderStore((s) => s.openInEditor)
    const binding = useBuilderStore((s) => s.binding)
    const closeBinding = useBuilderStore((s) => s.closeBinding)
    const activeLayer = useBuilderStore((s) => s.activeLayer)
    const [buildModal, setBuildModal] = useState<
        'preset' | 'grid' | 'kle' | 'import' | null
    >(null)
    const [exportOpen, setExportOpen] = useState(false)
    const [libraryOpen, setLibraryOpen] = useState(false)
    // Tracks whether a build-from / library modal was reached via the start
    // chooser — only then do those modals show a "back to start" chevron.
    const [fromStart, setFromStart] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    // Starting-point chooser: only on a genuinely fresh open (no board yet).
    // Returning from the editor — or any reopen with a config already loaded —
    // skips it so the user lands back on their existing board.
    const [startOpen, setStartOpen] = useState(
        () => !useConfigStore.getState().config,
    )
    // Return from a secondary modal to the start chooser (back chevron).
    const backToStart = (): void => {
        setBuildModal(null)
        setLibraryOpen(false)
        setFromStart(false)
        setStartOpen(true)
    }
    // Open a secondary modal from the start chooser, remembering the origin so
    // it shows a back chevron (toolbar/panel opens won't).
    const openFromStart = (modal: 'preset' | 'kle' | 'import'): void => {
        setFromStart(true)
        setBuildModal(modal)
    }
    // First-run tour: bumping the nonce replays it from the "?" toolbar button.
    const [tourNonce, setTourNonce] = useState(0)

    const handleSave = (): void => {
        if (!config) return
        saveBoard(config)
        toast.success(`Saved "${config.meta.name}" to your library`)
    }

    // Exit (top-left Back) → start page. If a demo service is still attached from
    // an earlier "Open in editor" handoff, tear it down first; otherwise App would
    // fall through to the editor (builderOpen=false + service) instead.
    const handleExitBuilder = (): void => {
        const conn = useConnectionStore.getState()
        const svc = conn.service
        if (svc?.deviceInfo.firmware === 'mock') {
            // Clear the store synchronously (so App lands on the start page this
            // render, no editor flash), then best-effort close the mock.
            conn.setService(null)
            conn.setDeviceName(null)
            void svc.disconnect()
        }
        setOpen(false)
    }

    // Seed a complete default board (the showcase preset) the first time the
    // builder opens with no config loaded, so closing the start dialog without
    // picking still leaves a usable keyboard — not a grid of transparent keys.
    // (A connected device would already have seeded configStore.)
    useEffect(() => {
        if (!config) setConfig(defaultBoardConfig())
    }, [config, setConfig])

    useBuilderKeyboard()

    // Matrix dimensions: the committed transform, else position-derived bands.
    // Split boards show per-half dims (each half is its own matrix).
    const dims = displayMatrixDims(config)
    const keyCount = config?.keyboard.keys.length ?? 0

    return (
        <div className="flex h-full flex-col bg-background">
            {/* ===== toolbar ===== */}
            <BuilderToolbar
                stage={stage}
                snapMode={snapMode}
                setSnapMode={setSnapMode}
                snapping={snapping}
                toggleSnapping={toggleSnapping}
                matrixView={matrixView}
                toggleMatrixView={toggleMatrixView}
                leftOpen={leftOpen}
                toggleLeft={toggleLeft}
                jsonOpen={jsonOpen}
                toggleJson={toggleJson}
                canUndo={canUndo}
                canRedo={canRedo}
                undo={undo}
                redo={redo}
                config={config}
                dims={dims}
                keyCount={keyCount}
                openInEditor={openInEditor}
                handleExitBuilder={handleExitBuilder}
                setLibraryOpen={setLibraryOpen}
                setTourNonce={setTourNonce}
                setSettingsOpen={setSettingsOpen}
                handleSave={handleSave}
                setExportOpen={setExportOpen}
            />

            {/* ===== body ===== */}
            <div className="flex min-h-0 flex-1">
                {/* left tools panel (collapsible) */}
                {/* pattern-check: skip — presentational JSX wiring of existing panels + modal-open state */}
                {leftOpen && (
                    <BuilderLeftPanel
                        config={config}
                        commit={commit}
                        setBuildModal={setBuildModal}
                    />
                )}

                {/* canvas */}
                <main
                    className="workbench-bg relative min-w-0 flex-1"
                    data-coach="builder-canvas"
                >
                    <BuilderCanvas />
                    {/* layout-variant bar (top-centre) */}
                    <div className="pointer-events-none absolute left-1/2 top-3.5 -translate-x-1/2">
                        <VariantBar />
                    </div>
                    {/* status / hint bar */}
                    <div
                        className="pointer-events-none absolute bottom-3.5 left-1/2 flex -translate-x-1/2 items-center gap-3.5 rounded-full border border-border px-3.5 py-2 text-[12px] text-muted-foreground shadow-lg backdrop-blur-md"
                        style={{
                            background:
                                'color-mix(in oklch, var(--card) 92%, transparent)',
                        }}
                    >
                        {selection.size ? (
                            <span className="font-semibold text-foreground">
                                {selection.size} selected
                            </span>
                        ) : (
                            <span>
                                Drag to marquee · Space/middle-drag to pan ·
                                scroll to zoom
                            </span>
                        )}
                        <span className="h-3.5 w-px bg-border" />
                        <span className="font-mono">
                            {snapMode === 'grid'
                                ? `snap ${snapping ? '⅛U' : 'off'}`
                                : 'free-form'}
                        </span>
                    </div>
                    {/* firmware-aware binding picker (bottom dock) */}
                    {binding && config && (
                        <BindingPicker
                            target={binding}
                            onClose={closeBinding}
                            onPick={(action) => {
                                const cfg = useConfigStore.getState().config
                                if (!cfg) return
                                commit(
                                    binding.slot === 'key'
                                        ? setBinding(
                                              cfg,
                                              activeLayer,
                                              binding.keyIndex,
                                              action,
                                          )
                                        : binding.slot === 'slider'
                                          ? setSliderBinding(
                                                cfg,
                                                activeLayer,
                                                binding.keyIndex,
                                                { map: 'custom', action },
                                            )
                                          : setEncoderBinding(
                                                cfg,
                                                activeLayer,
                                                binding.keyIndex,
                                                binding.slot,
                                                action,
                                            ),
                                )
                            }}
                        />
                    )}
                </main>

                {/* right dock — JSON editor (480px) always, else the inspector but
                    only while a key is selected (canvas widens when nothing is). */}
                {/* pattern-check: skip — conditional dock render, presentational */}
                <BuilderRightDock
                    jsonOpen={jsonOpen}
                    setJsonOpen={setJsonOpen}
                    selectionSize={selection.size}
                />
            </div>

            <BuilderModalsCluster
                buildModal={buildModal}
                setBuildModal={setBuildModal}
                fromStart={fromStart}
                setFromStart={setFromStart}
                backToStart={backToStart}
                openFromStart={openFromStart}
                exportOpen={exportOpen}
                setExportOpen={setExportOpen}
                libraryOpen={libraryOpen}
                setLibraryOpen={setLibraryOpen}
                settingsOpen={settingsOpen}
                setSettingsOpen={setSettingsOpen}
                startOpen={startOpen}
                setStartOpen={setStartOpen}
                tourNonce={tourNonce}
            />
        </div>
    )
}
