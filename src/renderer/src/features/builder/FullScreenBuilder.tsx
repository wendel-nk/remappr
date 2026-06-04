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
import { useEffect, useMemo } from 'react'
import {
    ArrowLeft,
    ArrowRight,
    Code2,
    Layers,
    Magnet,
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
    duplicateKeys,
    newBoardConfig,
    removeKeys,
    snap as snapStep,
    updateKeys,
} from './geometryEditor'
import { BuilderCanvas } from './BuilderCanvas'

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

const SOON = 'Coming in a later phase'

export function FullScreenBuilder(): JSX.Element {
    const setOpen = useBuilderStore((s) => s.setOpen)
    const snapMode = useBuilderStore((s) => s.snapMode)
    const setSnapMode = useBuilderStore((s) => s.setSnapMode)
    const selection = useBuilderStore((s) => s.selection)
    const canUndo = useBuilderStore((s) => s.past.length > 0)
    const canRedo = useBuilderStore((s) => s.future.length > 0)
    const undo = useBuilderStore((s) => s.undo)
    const redo = useBuilderStore((s) => s.redo)
    const config = useConfigStore((s) => s.config)
    const setConfig = useConfigStore((s) => s.setConfig)

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

    // Grid dimensions from geometry (no row/col fields yet — derive from extent).
    const dims = useMemo(() => {
        const keys = config?.keyboard.keys ?? []
        let cols = 0
        let rows = 0
        for (const k of keys) {
            cols = Math.max(cols, Math.round(k.x + k.w))
            rows = Math.max(rows, Math.round(k.y + k.h))
        }
        return { rows, cols, count: keys.length }
    }, [config])

    const single =
        selection.size === 1 && config
            ? config.keyboard.keys[[...selection][0]]
            : null

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
                            {dims.rows}×{dims.cols} · {dims.count} keys
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <SnapSeg value={snapMode} onChange={setSnapMode} />
                    <ToolButton label="Matrix wiring view" disabled>
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
                    <ToolButton label="Edit config JSON — coming soon" disabled>
                        <Code2 size={18} />
                    </ToolButton>
                    <ToolButton label="Keyboard library" disabled>
                        <Layers size={18} />
                    </ToolButton>
                    <button
                        type="button"
                        disabled
                        className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-[13px] font-semibold text-secondary-foreground disabled:opacity-40"
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
                        disabled
                        className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-[13px] font-semibold text-secondary-foreground disabled:opacity-40"
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
                        onClick={() =>
                            toast.info('Export & build', { description: SOON })
                        }
                        className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
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
                <aside className="flex w-[270px] shrink-0 flex-col overflow-y-auto border-r border-border bg-sidebar">
                    <div className="border-b border-border p-3.5">
                        <SectionTitle>Layers</SectionTitle>
                        <ul className="mt-2.5 space-y-1">
                            {(config?.layers ?? []).map((l, i) => (
                                <li
                                    key={i}
                                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground"
                                >
                                    <span className="text-[11px] font-mono text-muted-foreground">
                                        L{i}
                                    </span>
                                    {l.name}
                                </li>
                            ))}
                        </ul>
                        <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                            Geometry &amp; matrix are shared across all layers.
                            Layer editing arrives in a later phase.
                        </p>
                    </div>
                    <div className="border-b border-border p-3.5">
                        <SectionTitle>Build from</SectionTitle>
                        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                            {[
                                'Presets',
                                'Import KLE',
                                'Make grid',
                                'Add key',
                            ].map((l) => (
                                <button
                                    key={l}
                                    type="button"
                                    disabled
                                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-left text-[12.5px] font-semibold text-foreground opacity-50"
                                >
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="p-4">
                        <SectionTitle>Identity</SectionTitle>
                        <div className="mt-2.5 text-sm text-foreground">
                            {config?.meta.name ?? '—'}
                        </div>
                        <div className="mt-1 text-[12px] text-muted-foreground">
                            Target: {config?.meta.target ?? 'agnostic'}
                        </div>
                    </div>
                </aside>

                {/* canvas */}
                <main className="workbench-bg relative min-w-0 flex-1">
                    <BuilderCanvas />
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
                            {snapMode === 'grid' ? 'snap ⅛U' : 'free-form'}
                        </span>
                    </div>
                </main>

                {/* right inspector */}
                <aside className="flex w-[296px] shrink-0 flex-col overflow-y-auto border-l border-border bg-sidebar">
                    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                        <SlidersHorizontal size={15} className="text-primary" />
                        <span className="text-[13px] font-bold">Inspector</span>
                    </div>
                    {single ? (
                        <div className="space-y-3 p-4 text-sm">
                            <div className="text-[12px] font-semibold text-muted-foreground">
                                Key #{[...selection][0]}
                            </div>
                            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[12px]">
                                <dt className="text-muted-foreground">X</dt>
                                <dd>{single.x}</dd>
                                <dt className="text-muted-foreground">Y</dt>
                                <dd>{single.y}</dd>
                                <dt className="text-muted-foreground">W</dt>
                                <dd>{single.w}</dd>
                                <dt className="text-muted-foreground">H</dt>
                                <dd>{single.h}</dd>
                                <dt className="text-muted-foreground">R</dt>
                                <dd>{single.r}°</dd>
                            </dl>
                            <p className="text-[12px] leading-relaxed text-muted-foreground">
                                Editing controls arrive in a later phase.
                            </p>
                        </div>
                    ) : (
                        <div className="p-6 text-center">
                            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl border border-dashed border-border text-muted-foreground">
                                <SlidersHorizontal size={18} />
                            </div>
                            <div className="text-sm font-semibold">
                                Nothing selected
                            </div>
                            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                                Click a key to inspect its size, position &amp;
                                matrix.
                            </p>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    )
}
