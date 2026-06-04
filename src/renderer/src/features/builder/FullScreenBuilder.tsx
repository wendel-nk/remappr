// Pattern check: no GoF pattern (-) — rejected — presentational full-screen shell
// (toolbar / left panel / canvas / right inspector); layout markup, no abstraction.
//
// The full-screen Keyboard Builder shell, ported 1:1 from the design prototype
// (app/builder/Builder.jsx): 52px toolbar, 270px left tools panel, flexible
// pan/zoom canvas, 296px right inspector. Theme-aware by construction — it uses
// the same CSS tokens (var(--primary)/--card/--sidebar/--border/...) the rest of
// the app does, and caps render through the production KeyButton.
//
// Phase 1 wires the shell, the Back button, the Snap/Free toggle, and the
// read-only canvas. Toolbar actions (undo/redo, JSON, library, save, editor,
// export) + the left build-tools + the editable inspector land in later phases;
// they render here disabled with a tooltip so the shell reads as complete.
import { useEffect, useState } from 'react'
import {
    ArrowLeft,
    ArrowRight,
    Code2,
    Layers,
    Magnet,
    Settings2,
    Maximize2,
    Minus,
    Move,
    Plus,
    Redo2,
    Rocket,
    Ruler,
    Save,
    Scan,
    SlidersHorizontal,
    Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import useBuilderStore, { type SnapMode } from '@/stores/builderStore'
import useConfigStore from '@/stores/configStore'
import {
    addKey,
    duplicateKeys,
    newBoardConfig,
    removeKeys,
    snap as snapStep,
    updateKeys,
} from './geometryEditor'
import { matrixDims } from './builderMatrix'
import { BuilderCanvas } from './BuilderCanvas'
import { BuilderLayersPanel } from './BuilderLayersPanel'
import { BuilderMetaForm } from './BuilderMetaForm'
import { BuilderInspector } from './BuilderInspector'
import { BindingPicker } from './BindingPicker'
import { setBinding, setEncoderBinding } from './builderInspectorOps'
import { VariantBar } from './VariantBar'
import { GridModal, KleModal, PresetModal, StartModal } from './BuilderModals'
import { BuilderExportModal } from './BuilderExportModal'
import { LibraryModal } from './LibraryModal'
import { saveBoard } from './builderLibrary'
import { JsonConfigPanel } from './JsonConfigPanel'
import { Settings } from '@/components/modals/Settings'

/** Gradient brand badge (ruler glyph) shared with the start-page CTA. */
function BrandBadge({ size = 28 }: { size?: number }): JSX.Element {
    return (
        <span
            className="grid shrink-0 place-items-center rounded-lg text-white"
            style={{
                width: size,
                height: size,
                background:
                    'linear-gradient(150deg, var(--primary), color-mix(in oklch, var(--primary) 65%, #000))',
            }}
        >
            <Ruler size={size * 0.57} />
        </span>
    )
}

/** A toolbar icon button with a tooltip. */
function ToolButton({
    label,
    onClick,
    active,
    disabled,
    children,
}: {
    label: string
    onClick?: () => void
    active?: boolean
    disabled?: boolean
    children: React.ReactNode
}): JSX.Element {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    onClick={onClick}
                    disabled={disabled}
                    aria-label={label}
                    aria-pressed={active}
                    className={`inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        active
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                    style={
                        { WebkitAppRegion: 'no-drag' } as React.CSSProperties
                    }
                >
                    {children}
                </button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    )
}

/** Snap-grid / Free-form segmented toggle. */
function SnapSeg({
    value,
    onChange,
}: {
    value: SnapMode
    onChange: (v: SnapMode) => void
}): JSX.Element {
    const opts: Array<{ v: SnapMode; label: string; icon: React.ReactNode }> = [
        { v: 'grid', label: 'Snap grid', icon: <Magnet size={14} /> },
        { v: 'free', label: 'Free form', icon: <Move size={14} /> },
    ]
    return (
        <div
            className="inline-flex gap-0.5 rounded-lg border border-border bg-card p-[3px]"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
            {opts.map((o) => (
                <button
                    key={o.v}
                    type="button"
                    onClick={() => onChange(o.v)}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-md px-[11px] text-[12.5px] font-bold transition-colors ${
                        o.v === value
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {o.icon}
                    {o.label}
                </button>
            ))}
        </div>
    )
}

// Pattern check: no GoF pattern (-) — rejected — presentational zoom-control
// cluster bound to builderStore.view; small UI component, no abstraction.
/** Zoom −/percent/+/reset cluster, reading + writing builderStore.view. */
function ZoomGroup(): JSX.Element {
    const zoom = useBuilderStore((s) => s.view.zoom)
    const setView = useBuilderStore((s) => s.setView)
    const resetView = useBuilderStore((s) => s.resetView)
    const clampZ = (z: number): number => Math.max(0.25, Math.min(4, z))
    return (
        <div
            className="inline-flex items-center gap-px rounded-lg border border-border bg-card p-[3px]"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
            <button
                type="button"
                aria-label="Zoom out"
                onClick={() => setView({ zoom: clampZ(zoom / 1.15) })}
                className="grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground"
            >
                <Minus size={15} />
            </button>
            <button
                type="button"
                aria-label="Reset view"
                onClick={resetView}
                className="min-w-[46px] text-center text-[12px] font-bold text-foreground"
            >
                {Math.round(zoom * 100)}%
            </button>
            <button
                type="button"
                aria-label="Zoom in"
                onClick={() => setView({ zoom: clampZ(zoom * 1.15) })}
                className="grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground"
            >
                <Plus size={15} />
            </button>
            <button
                type="button"
                aria-label="Fit"
                onClick={resetView}
                className="grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground"
            >
                <Maximize2 size={13} />
            </button>
        </div>
    )
}

function SectionTitle({
    children,
}: {
    children: React.ReactNode
}): JSX.Element {
    return (
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {children}
        </div>
    )
}

/** A left-panel "Build from" action button. */
function BuildButton({
    label,
    onClick,
}: {
    label: string
    onClick: () => void
}): JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-left text-[12.5px] font-semibold text-foreground transition-colors hover:border-primary"
        >
            {label}
        </button>
    )
}

// pattern-check: skip — remove dead SOON const; FullScreenBuilder unchanged
export function FullScreenBuilder(): JSX.Element {
    const setOpen = useBuilderStore((s) => s.setOpen)
    const snapMode = useBuilderStore((s) => s.snapMode)
    const setSnapMode = useBuilderStore((s) => s.setSnapMode)
    const snapping = useBuilderStore((s) => s.snapping)
    const toggleSnapping = useBuilderStore((s) => s.toggleSnapping)
    const selection = useBuilderStore((s) => s.selection)
    const matrixView = useBuilderStore((s) => s.matrixView)
    const toggleMatrixView = useBuilderStore((s) => s.toggleMatrixView)
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
        'preset' | 'grid' | 'kle' | null
    >(null)
    const [exportOpen, setExportOpen] = useState(false)
    const [libraryOpen, setLibraryOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    // Starting-point chooser, shown once each time the builder is opened.
    const [startOpen, setStartOpen] = useState(true)

    const handleSave = (): void => {
        if (!config) return
        saveBoard(config)
        toast.success(`Saved "${config.meta.name}" to your library`)
    }

    // Seed a default from-scratch board the first time the builder opens with no
    // config loaded (a connected device would already have seeded configStore).
    useEffect(() => {
        if (!config) {
            setConfig(
                newBoardConfig({
                    name: 'My Keyboard',
                    rows: 4,
                    cols: 12,
                    target: 'zmk',
                }),
            )
        }
    }, [config, setConfig])

    // Keyboard shortcuts (ported from the prototype): undo/redo, select-all,
    // duplicate, delete, arrow-nudge, escape. Skipped while typing in a field.
    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            const t = e.target as HTMLElement
            if (
                t.tagName === 'INPUT' ||
                t.tagName === 'TEXTAREA' ||
                t.isContentEditable
            )
                return
            const store = useBuilderStore.getState()
            const cfg = useConfigStore.getState().config
            const mod = e.metaKey || e.ctrlKey
            if (mod && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault()
                e.shiftKey ? store.redo() : store.undo()
                return
            }
            if (mod && e.key === 'y') {
                e.preventDefault()
                store.redo()
                return
            }
            if (e.key === 'Escape') {
                store.clearSelection()
                return
            }
            if (!cfg) return
            if (mod && (e.key === 'a' || e.key === 'A')) {
                e.preventDefault()
                store.setSelection(new Set(cfg.keyboard.keys.map((_, i) => i)))
                return
            }
            const sel = store.selection
            if (mod && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault()
                if (!sel.size) return
                const { config: next, newIndices } = duplicateKeys(cfg, sel)
                store.commit(next)
                store.setSelection(new Set(newIndices))
                return
            }
            if (!sel.size) return
            if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault()
                store.commit(removeKeys(cfg, sel))
                store.clearSelection()
                return
            }
            if (e.key.startsWith('Arrow')) {
                e.preventDefault()
                const step = e.shiftKey ? 1 : 0.25
                const d: Record<string, [number, number]> = {
                    ArrowLeft: [-step, 0],
                    ArrowRight: [step, 0],
                    ArrowUp: [0, -step],
                    ArrowDown: [0, step],
                }
                const delta = d[e.key]
                if (!delta) return
                store.commit(
                    updateKeys(cfg, (k, i) =>
                        sel.has(i)
                            ? {
                                  ...k,
                                  x: snapStep(k.x + delta[0], 0.001),
                                  y: snapStep(k.y + delta[1], 0.001),
                                  ...(k.rx !== undefined
                                      ? { rx: k.rx + delta[0] }
                                      : {}),
                                  ...(k.ry !== undefined
                                      ? { ry: k.ry + delta[1] }
                                      : {}),
                              }
                            : k,
                    ),
                )
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    // Matrix dimensions: the committed transform, else position-derived bands.
    const dims = matrixDims(config)
    const keyCount = config?.keyboard.keys.length ?? 0

    return (
        <div className="flex h-full flex-col bg-background">
            {/* ===== toolbar ===== */}
            <header
                className="relative z-30 flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-card px-3"
                style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            >
                <div className="flex items-center gap-2">
                    <ToolButton label="Back" onClick={() => setOpen(false)}>
                        <ArrowLeft size={17} />
                    </ToolButton>
                    <BrandBadge />
                    <div className="flex items-baseline gap-2">
                        <span className="text-[14.5px] font-extrabold">
                            Builder
                        </span>
                        <span className="text-[11px] font-semibold text-muted-foreground">
                            {dims.rows}×{dims.cols} · {keyCount} keys
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
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
                        label="Settings"
                        onClick={() => setSettingsOpen(true)}
                    >
                        <Settings2 size={18} />
                    </ToolButton>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!config}
                        className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-[13px] font-semibold text-secondary-foreground transition-colors hover:border-primary disabled:opacity-40"
                        style={
                            {
                                WebkitAppRegion: 'no-drag',
                            } as React.CSSProperties
                        }
                    >
                        <Save size={14} /> Save
                    </button>
                    <button
                        type="button"
                        onClick={openInEditor}
                        disabled={!config}
                        className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-[13px] font-semibold text-secondary-foreground transition-colors hover:border-primary disabled:opacity-40"
                        style={
                            {
                                WebkitAppRegion: 'no-drag',
                            } as React.CSSProperties
                        }
                    >
                        <ArrowRight size={14} /> Editor
                    </button>
                    <button
                        type="button"
                        onClick={() => setExportOpen(true)}
                        disabled={!config}
                        className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                        style={
                            {
                                WebkitAppRegion: 'no-drag',
                            } as React.CSSProperties
                        }
                    >
                        <Rocket size={15} /> Export &amp; build
                    </button>
                </div>
            </header>

            {/* ===== body ===== */}
            <div className="flex min-h-0 flex-1">
                {/* left tools panel */}
                {/* pattern-check: skip — presentational JSX wiring of existing panels + modal-open state */}
                <aside className="flex w-[270px] shrink-0 flex-col overflow-y-auto border-r border-border bg-sidebar">
                    <div className="border-b border-border p-3.5">
                        <SectionTitle>Layers</SectionTitle>
                        <div className="mt-2.5">
                            <BuilderLayersPanel />
                        </div>
                        <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                            Geometry &amp; matrix are shared across all layers.
                        </p>
                    </div>
                    <div className="border-b border-border p-3.5">
                        <SectionTitle>Build from</SectionTitle>
                        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                            <BuildButton
                                label="Presets"
                                onClick={() => setBuildModal('preset')}
                            />
                            <BuildButton
                                label="Import KLE"
                                onClick={() => setBuildModal('kle')}
                            />
                            <BuildButton
                                label="Make grid"
                                onClick={() => setBuildModal('grid')}
                            />
                            <BuildButton
                                label="Add key"
                                onClick={() => config && commit(addKey(config))}
                            />
                        </div>
                    </div>
                    <div className="p-4">
                        <SectionTitle>Identity</SectionTitle>
                        <div className="mt-3">
                            <BuilderMetaForm />
                        </div>
                    </div>
                </aside>

                {/* canvas */}
                <main className="workbench-bg relative min-w-0 flex-1">
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

                {/* right dock — JSON config editor (480px) or inspector (296px) */}
                {/* pattern-check: skip — conditional dock render, presentational */}
                {jsonOpen ? (
                    <aside className="flex w-[480px] shrink-0 flex-col border-l border-border bg-sidebar">
                        <JsonConfigPanel onClose={() => setJsonOpen(false)} />
                    </aside>
                ) : (
                    <aside className="flex w-[296px] shrink-0 flex-col overflow-y-auto border-l border-border bg-sidebar">
                        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                            <SlidersHorizontal
                                size={15}
                                className="text-primary"
                            />
                            <span className="text-[13px] font-bold">
                                Inspector
                            </span>
                        </div>
                        <BuilderInspector />
                    </aside>
                )}
            </div>

            {/* build-from modals */}
            <PresetModal
                open={buildModal === 'preset'}
                onClose={() => setBuildModal(null)}
            />
            <GridModal
                open={buildModal === 'grid'}
                onClose={() => setBuildModal(null)}
            />
            <KleModal
                open={buildModal === 'kle'}
                onClose={() => setBuildModal(null)}
            />

            {/* export & build + library */}
            <BuilderExportModal
                open={exportOpen}
                onClose={() => setExportOpen(false)}
            />
            <LibraryModal
                open={libraryOpen}
                onClose={() => setLibraryOpen(false)}
            />
            {settingsOpen && (
                <Settings
                    opened={settingsOpen}
                    onClose={() => setSettingsOpen(false)}
                    sections={['general', 'keycaps', 'workspace', 'about']}
                />
            )}
            <StartModal
                open={startOpen}
                onClose={() => setStartOpen(false)}
                onPreset={() => setBuildModal('preset')}
                onKle={() => setBuildModal('kle')}
            />
        </div>
    )
}
