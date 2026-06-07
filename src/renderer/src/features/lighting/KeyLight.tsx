// pattern-check: skip — presentational glow layer over computeKeyLight, no abstraction
import { memo, useMemo } from 'react'
import type { HsvColor } from '@firmware/service'
import { computeKeyLight, type UnifiedLighting } from './engine'

interface KeyLightProps {
    cfg: UnifiedLighting
    /** Key centre normalized 0..1 on the board (drives spatial hue). */
    fx?: number
    fy?: number
    /** Stable key index (seeds the twinkle effect). */
    idx?: number
    /** Current 1U size in px (scales the glow radius). */
    oneU?: number
    /** Border-radius to match the keycap face. */
    radius?: number
    /** For 'reactive': true while hovered/pressed. */
    lit?: boolean
    /** Per-key colour override (device HSV 0–255) — paint mode / device colours. */
    color?: HsvColor
}

/** The glow layer — drop inside a keycap (above the face, below the legend). It is
 *  one absolutely-positioned inset:0 div with mixBlendMode:'screen' and a box-shadow
 *  glow (no face fill, so the cap colour shows through). Returns null when disabled.
 *  The 'reactive' effect also lights on hover via the .kl-reactive CSS rule (it
 *  brightens when an ancestor `.group` is hovered). */
function KeyLightImpl({
    cfg,
    fx = 0.5,
    fy = 0.5,
    idx = 0,
    oneU = 56,
    radius,
    lit = false,
    color,
}: KeyLightProps): JSX.Element | null {
    const g = useMemo(
        () => computeKeyLight(cfg, fx, fy, idx, oneU, lit, color),
        [cfg, fx, fy, idx, oneU, lit, color],
    )
    const style = useMemo(
        () =>
            g
                ? radius != null
                    ? { ...g.style, borderRadius: radius }
                    : g.style
                : undefined,
        [g, radius],
    )
    if (!g) return null
    return (
        <div
            aria-hidden
            // `kl-anim` (animated effects only) scopes the will-change layer promotion
            // to the keys that actually animate — static glows stay un-promoted.
            className={`kl-glow${g.style.animation ? ' kl-anim' : ''}${
                g.reactive ? ' kl-reactive' : ''
            }`}
            style={style}
        />
    )
}

export const KeyLight = memo(KeyLightImpl)
