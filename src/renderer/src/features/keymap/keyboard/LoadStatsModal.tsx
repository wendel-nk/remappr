// Pattern check: no GoF pattern (-) — rejected — aggregates heatmap press counts into
// hand/finger buckets via key geometry; pure computation + presentational bars, no abstraction.
import { useMemo } from 'react'
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

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Typing load"
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
                <div className="space-y-6">
                    <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>Left {leftPct}%</span>
                            <span>{stats.total} presses</span>
                            <span>{rightPct}% Right</span>
                        </div>
                        <div className="flex h-3 overflow-hidden rounded-full bg-secondary">
                            <div
                                className="bg-primary"
                                style={{ width: `${leftPct}%` }}
                            />
                            <div
                                className="bg-primary/40"
                                style={{ width: `${rightPct}%` }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {(['Left hand', 'Right hand'] as const).map(
                            (handLabel, hand) => (
                                <div key={handLabel} className="space-y-2">
                                    <h4 className="text-sm font-semibold">
                                        {handLabel}
                                    </h4>
                                    {FINGERS.map((finger, fi) => {
                                        const v = stats.fingers[hand][fi]
                                        const pct = Math.round(
                                            (v / stats.topFinger) * 100,
                                        )
                                        return (
                                            <div
                                                key={finger}
                                                className="flex items-center gap-2"
                                            >
                                                <span className="w-12 shrink-0 text-xs text-muted-foreground">
                                                    {finger}
                                                </span>
                                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                                                    <div
                                                        className="h-full rounded-full bg-primary"
                                                        style={{
                                                            width: `${pct}%`,
                                                        }}
                                                    />
                                                </div>
                                                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                                                    {v}
                                                </span>
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
