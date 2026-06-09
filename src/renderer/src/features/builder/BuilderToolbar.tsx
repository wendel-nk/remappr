// pattern-check: skip — extract toolbar header JSX into a props-driven presentational component, no abstraction
// The 52px builder toolbar, extracted verbatim from Builder.tsx. Pure presentation:
// every action/state is threaded in as a prop, so this component holds no store
// wiring of its own. It composes the existing builderChrome controls
// (BrandBadge / BuildButton / SnapSeg / ToolButton / ZoomGroup) and WindowControls.
import {
    ArrowLeft,
    ArrowRight,
    Code2,
    HelpCircle,
    Layers,
    Magnet,
    PanelLeft,
    PanelLeftClose,
    Redo2,
    Rocket,
    Save,
    Scan,
    Settings2,
    Undo2,
} from 'lucide-react'
import type { ConfigKeymap } from '@firmware/config'
import type { BuilderStage } from '@/lib/entitlements/entitlements'
import type { SnapMode } from '@/stores/builderStore'
import type { DisplayMatrixDims } from './builderMatrix'
import { BrandBadge, SnapSeg, ToolButton, ZoomGroup } from './builderChrome'
import { WindowControls } from '@/layout/WindowControls'

// Hoisted: stable refs for the Electron title-bar drag regions (an inline object would
// be a fresh ref each render).
const DRAG_REGION = { WebkitAppRegion: 'drag' } as React.CSSProperties
const NO_DRAG_REGION = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

export interface BuilderToolbarProps {
    stage: BuilderStage
    snapMode: SnapMode
    setSnapMode: (mode: SnapMode) => void
    snapping: boolean
    toggleSnapping: () => void
    matrixView: boolean
    toggleMatrixView: () => void
    leftOpen: boolean
    toggleLeft: () => void
    jsonOpen: boolean
    toggleJson: () => void
    canUndo: boolean
    canRedo: boolean
    undo: () => void
    redo: () => void
    config: ConfigKeymap | null
    dims: DisplayMatrixDims
    keyCount: number
    openInEditor: () => void
    handleExitBuilder: () => void
    setLibraryOpen: (open: boolean) => void
    setTourNonce: (fn: (n: number) => number) => void
    setSettingsOpen: (open: boolean) => void
    handleSave: () => void
    setExportOpen: (open: boolean) => void
}

export function BuilderToolbar({
    stage,
    snapMode,
    setSnapMode,
    snapping,
    toggleSnapping,
    matrixView,
    toggleMatrixView,
    leftOpen,
    toggleLeft,
    jsonOpen,
    toggleJson,
    canUndo,
    canRedo,
    undo,
    redo,
    config,
    dims,
    keyCount,
    openInEditor,
    handleExitBuilder,
    setLibraryOpen,
    setTourNonce,
    setSettingsOpen,
    handleSave,
    setExportOpen,
}: BuilderToolbarProps): JSX.Element {
    return (
        <header
            className="relative z-30 flex h-[52px] shrink-0 items-center border-b border-border bg-card pl-3"
            style={DRAG_REGION}
        >
            <div className="flex items-center gap-2">
                <ToolButton label="Back" onClick={handleExitBuilder}>
                    <ArrowLeft size={17} />
                </ToolButton>
                <ToolButton
                    label={leftOpen ? 'Hide panel' : 'Show panel'}
                    active={!leftOpen}
                    onClick={toggleLeft}
                >
                    {leftOpen ? (
                        <PanelLeftClose size={18} />
                    ) : (
                        <PanelLeft size={18} />
                    )}
                </ToolButton>
                <BrandBadge />
                <div className="flex items-baseline gap-2">
                    <span className="text-[14.5px] font-extrabold">
                        Builder
                    </span>
                    {stage !== 'ga' && (
                        <span
                            className="inline-flex items-baseline gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400"
                            style={{
                                background:
                                    'color-mix(in oklch, var(--primary) 12%, transparent)',
                            }}
                            title="Free during alpha & beta — premium (account required) once every firmware is supported"
                        >
                            {stage} · Free
                        </span>
                    )}
                    <span className="text-[11px] font-semibold text-muted-foreground">
                        {dims.rows}×{dims.cols}
                        {dims.perHalf ? ' per half' : ''} · {keyCount} keys
                    </span>
                </div>
            </div>

            {/* draggable spacer */}
            <div className="h-full flex-1" />

            <div className="flex items-center gap-2 pr-2">
                <SnapSeg value={snapMode} onChange={setSnapMode} />
                <ToolButton
                    label={snapping ? 'Snapping on' : 'Snapping off'}
                    active={snapping}
                    onClick={toggleSnapping}
                >
                    <Magnet size={18} />
                </ToolButton>
                <ToolButton
                    label="Matrix wiring view"
                    active={matrixView}
                    onClick={toggleMatrixView}
                    dataCoach="builder-matrix"
                >
                    <Scan size={18} />
                </ToolButton>
                <div className="mx-0.5 h-[22px] w-px bg-border" />
                <ToolButton label="Undo" onClick={undo} disabled={!canUndo}>
                    <Undo2 size={18} />
                </ToolButton>
                <ToolButton label="Redo" onClick={redo} disabled={!canRedo}>
                    <Redo2 size={18} />
                </ToolButton>
                <ZoomGroup />
                <div className="mx-0.5 h-[22px] w-px bg-border" />
                <ToolButton
                    label="Edit config JSON"
                    active={jsonOpen}
                    onClick={toggleJson}
                >
                    <Code2 size={18} />
                </ToolButton>
                <ToolButton
                    label="Keyboard library"
                    onClick={() => setLibraryOpen(true)}
                >
                    <Layers size={18} />
                </ToolButton>
                <ToolButton
                    label="Replay builder tour"
                    onClick={() => setTourNonce((n) => n + 1)}
                >
                    <HelpCircle size={18} />
                </ToolButton>
                <ToolButton
                    label="Settings"
                    onClick={() => setSettingsOpen(true)}
                >
                    <Settings2 size={18} />
                </ToolButton>
                <ToolButton
                    label="Save to library"
                    onClick={handleSave}
                    disabled={!config}
                >
                    <Save size={18} />
                </ToolButton>
                <button
                    type="button"
                    onClick={openInEditor}
                    disabled={!config}
                    className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-[13px] font-semibold text-secondary-foreground transition-colors hover:border-primary disabled:opacity-40"
                    style={NO_DRAG_REGION}
                >
                    <ArrowRight size={14} /> Editor
                </button>
                <button
                    type="button"
                    onClick={() => setExportOpen(true)}
                    disabled={!config}
                    data-coach="builder-export"
                    className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={NO_DRAG_REGION}
                >
                    <Rocket size={15} /> Export &amp; build
                </button>
            </div>

            {/* native window controls (Electron, non-mac) merged into the bar */}
            <WindowControls />
        </header>
    )
}
