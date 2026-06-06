// pattern-check: skip presentational chrome components extracted verbatim from FullScreenBuilder.tsx (readability split)
// Leaf presentational pieces for the full-screen builder shell: the brand badge,
// toolbar icon button, snap/free segmented toggle, zoom cluster, section title,
// and "Build from" button. No state of their own beyond ZoomGroup's view reads.
import type React from 'react'
import { Magnet, Maximize2, Minus, Move, Plus, Ruler } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import useBuilderStore, { type SnapMode } from '@/stores/builderStore'
import { clamp } from '@/lib/clampInt'
import { Z_MAX, Z_MIN } from './BuilderCanvas'

/** Gradient brand badge (ruler glyph) shared with the start-page CTA. */
export function BrandBadge({ size = 28 }: { size?: number }): JSX.Element {
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
export function ToolButton({
    label,
    onClick,
    active,
    disabled,
    dataCoach,
    children,
}: {
    label: string
    onClick?: () => void
    active?: boolean
    disabled?: boolean
    dataCoach?: string
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
                    data-coach={dataCoach}
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
export function SnapSeg({
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
export function ZoomGroup(): JSX.Element {
    const zoom = useBuilderStore((s) => s.view.zoom)
    const setView = useBuilderStore((s) => s.setView)
    const resetView = useBuilderStore((s) => s.resetView)
    const clampZ = (z: number): number => clamp(z, Z_MIN, Z_MAX)
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

export function SectionTitle({
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
export function BuildButton({
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
