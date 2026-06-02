// Pattern check: no GoF pattern (-) — rejected — aggregates heatmap press counts into
// hand/finger buckets via key geometry; pure computation + presentational bars, no abstraction.
import { useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import { Modal } from '@/ui/modal'
import { useLayout } from '@/hooks/use-layouts'
import useHeatmapStore from '@/stores/heatmapStore'

const FINGERS = ['Pinky', 'Ring', 'Middle', 'Index', 'Thumb'] as const

interface LoadStatsModalProps {
    opened: boolean
    onClose: () => void
}

interface Stats {
    total: number
    left: number
    right: number
    // [hand][finger] press counts; hand 0 = left, 1 = right.
    fingers: [number[], number[]]
    topFinger: number
}

export function LoadStatsModal({
    opened,
    onClose,
}: LoadStatsModalProps): JSX.Element {
    const { layouts, selectedPhysicalLayoutIndex } = useLayout()
    const counts = useHeatmapStore((s) => s.counts)

    const stats: Stats = useMemo(() => {
        const empty: Stats = {
            total: 0,
            left: 0,
            right: 0,
            fingers: [
                [0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0],
            ],
            topFinger: 0,
        }
        const layout = layouts?.[selectedPhysicalLayoutIndex]
        if (!layout || layout.keys.length === 0) return empty

        const xs = layout.keys.map((k) => k.x + k.w / 2)
        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const midX = (minX + maxX) / 2
        // Per-hand x ranges, so fingers band within each hand independently.
        const leftXs = xs.filter((x) => x < midX)
        const rightXs = xs.filter((x) => x >= midX)
        const lMin = leftXs.length ? Math.min(...leftXs) : minX
        const lMax = leftXs.length ? Math.max(...leftXs) : midX
        const rMin = rightXs.length ? Math.min(...rightXs) : midX
        const rMax = rightXs.length ? Math.max(...rightXs) : maxX

        const band = (x: number, lo: number, hi: number): number => {
            if (hi <= lo) return 0
            return Math.min(
                4,
                Math.max(0, Math.floor(((x - lo) / (hi - lo)) * 5)),
            )
        }

        const out: Stats = {
            total: 0,
            left: 0,
            right: 0,
            fingers: [
                [0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0],
            ],
            topFinger: 0,
        }
        layout.keys.forEach((k, pos) => {
            const c = counts[`${selectedPhysicalLayoutIndex}:${pos}`] ?? 0
            if (!c) return
            const cx = k.x + k.w / 2
            out.total += c
            if (cx < midX) {
                out.left += c
                // Left hand: pinky outermost (smallest x) → thumb innermost.
                out.fingers[0][band(cx, lMin, lMax)] += c
            } else {
                out.right += c
                // Right hand mirrored: thumb innermost (smallest x) → pinky outermost.
                out.fingers[1][4 - band(cx, rMin, rMax)] += c
            }
        })
        out.topFinger = Math.max(...out.fingers[0], ...out.fingers[1], 1)
        return out
    }, [layouts, selectedPhysicalLayoutIndex, counts])

    const leftPct = stats.total
        ? Math.round((stats.left / stats.total) * 100)
        : 50
    const rightPct = 100 - leftPct

    const totalLabel =
        stats.total < 1000
            ? String(stats.total)
            : `${(stats.total / 1000).toFixed(1)}k`
    const balanceNote =
        Math.abs(leftPct - 50) < 6
            ? 'Nicely balanced between hands.'
            : `Your ${
                  leftPct > 50 ? 'left' : 'right'
              } hand carries more load — consider moving a hot key to the other half.`

    // pattern-check: skip — presentational stats layout, no abstraction
    // Per-hand accent hues (design): left violet, right blue.
    const HAND_HUE = [286, 210] as const

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Typing load"
            subtitle="Hand balance & per-finger load"
            headerIcon={<BarChart3 />}
            customModalBoxClass="w-11/14 max-w-2xl"
            xButton
            isDismissable
            showFooter={false}
        >
            {stats.total === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                    No presses recorded yet. Enable the heatmap and type on your
                    keyboard to build up load stats.
                </p>
            ) : (
                <div className="space-y-5">
                    {/* hand balance + total */}
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <div className="flex-1 rounded-xl border bg-background p-4">
                            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                Hand balance
                            </p>
                            <div className="flex items-center gap-2.5">
                                <span
                                    className="text-xs font-bold"
                                    style={{ color: 'oklch(0.7 0.15 286)' }}
                                >
                                    L {leftPct}%
                                </span>
                                <div className="flex h-2.5 flex-1 overflow-hidden rounded-full">
                                    <div
                                        style={{
                                            width: `${leftPct}%`,
                                            background: 'oklch(0.6 0.16 286)',
                                        }}
                                    />
                                    <div
                                        style={{
                                            width: `${rightPct}%`,
                                            background: 'oklch(0.6 0.16 210)',
                                        }}
                                    />
                                </div>
                                <span
                                    className="text-xs font-bold"
                                    style={{ color: 'oklch(0.7 0.15 210)' }}
                                >
                                    {rightPct}% R
                                </span>
                            </div>
                            <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                                {balanceNote}
                            </p>
                        </div>
                        <div className="rounded-xl border bg-background p-4 text-center sm:w-36">
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                Total
                            </p>
                            <div className="text-2xl font-extrabold tabular-nums">
                                {totalLabel}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                                presses
                            </div>
                        </div>
                    </div>

                    {/* per-finger bars */}
                    <div className="flex flex-col gap-6 sm:flex-row">
                        {(['Left hand', 'Right hand'] as const).map(
                            (handLabel, hand) => (
                                <div key={handLabel} className="flex-1">
                                    <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                        {handLabel}
                                    </p>
                                    {FINGERS.map((finger, fi) => {
                                        const v = stats.fingers[hand][fi]
                                        const pct = Math.round(
                                            (v / stats.topFinger) * 100,
                                        )
                                        return (
                                            <div
                                                key={finger}
                                                className="mb-2.5"
                                            >
                                                <div className="mb-1 flex justify-between">
                                                    <span className="text-[12.5px] font-semibold">
                                                        {finger}
                                                    </span>
                                                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                                        {v}
                                                    </span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                                                    <div
                                                        className="h-full rounded-full transition-[width] duration-300"
                                                        style={{
                                                            width: `${pct}%`,
                                                            background: `oklch(0.65 0.16 ${HAND_HUE[hand]})`,
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ),
                        )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                        Finger attribution is approximate — keys are bucketed by
                        position across each hand.
                    </p>
                </div>
            )}
        </Modal>
    )
}
