// pattern-check: skip — pure/JSX helpers extracted verbatim from KeyboardView
import { HidUsageLabel } from '../HidUsageLabel'
import type { KeyPosition } from '../PhysicalLayoutCanvas'
import type { HoldTapLabels } from '../KeyButton'
import type { ResolvedHoldTapDescriptor } from '@firmware'

export interface EncoderSelection {
    slot: number
    dir: 'cw' | 'ccw'
}

/** Nearest key (by centre geometry) to `from` in a direction; null if none. */
export function neighborInDirection(
    positions: KeyPosition[],
    from: number,
    dir: 'left' | 'right' | 'up' | 'down',
): number | null {
    const a = positions[from]
    if (!a || a.encoder) return null
    const acx = a.x + a.width / 2
    const acy = a.y + a.height / 2
    let best: number | null = null
    let bestScore = Infinity
    positions.forEach((p, i) => {
        if (i === from || p.encoder) return
        const dx = p.x + p.width / 2 - acx
        const dy = p.y + p.height / 2 - acy
        let primary: number
        let cross: number
        if (dir === 'left') {
            if (dx >= -0.1) return
            primary = -dx
            cross = Math.abs(dy)
        } else if (dir === 'right') {
            if (dx <= 0.1) return
            primary = dx
            cross = Math.abs(dy)
        } else if (dir === 'up') {
            if (dy >= -0.1) return
            primary = -dy
            cross = Math.abs(dx)
        } else {
            if (dy <= 0.1) return
            primary = dy
            cross = Math.abs(dx)
        }
        const score = primary + cross * 2
        if (score < bestScore) {
            bestScore = score
            best = i
        }
    })
    return best
}

export function holdTapToLabels(
    desc: ResolvedHoldTapDescriptor,
): HoldTapLabels {
    const tap = (
        <HidUsageLabel
            hid_usage={desc.tapParam}
            header={desc.actionTypeName}
            hideMods
        />
    )
    const hold =
        desc.holdNodeKind === 'layer' ? (
            <span>{desc.holdLayerMomentary}</span>
        ) : (
            <HidUsageLabel hid_usage={desc.holdParam} />
        )
    return { tap, hold, tooltip: desc.tooltip }
}
