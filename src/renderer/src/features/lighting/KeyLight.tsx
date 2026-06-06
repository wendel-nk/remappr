// pattern-check: skip — presentational glow layer over computeKeyLight, no abstraction
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
}

/** The glow layer — drop inside a keycap (above the face, below the legend). It is
 *  one absolutely-positioned inset:0 div with mixBlendMode:'screen' and a box-shadow
 *  glow (no face fill, so the cap colour shows through). Returns null when disabled.
 *  The 'reactive' effect also lights on hover via the .kl-reactive CSS rule (it
 *  brightens when an ancestor `.group` is hovered). */
export function KeyLight({
    cfg,
    fx = 0.5,
    fy = 0.5,
    idx = 0,
    oneU = 56,
    radius,
    lit = false,
}: KeyLightProps): JSX.Element | null {
    const g = computeKeyLight(cfg, fx, fy, idx, oneU, lit)
    if (!g) return null
    const style =
        radius != null ? { ...g.style, borderRadius: radius } : g.style
    return (
        <div
            aria-hidden
            className={`kl-glow${g.reactive ? ' kl-reactive' : ''}`}
            style={style}
        />
    )
}
