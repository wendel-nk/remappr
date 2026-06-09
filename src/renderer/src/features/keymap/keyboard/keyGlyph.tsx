// Pattern check: no GoF pattern (-) — rejected — single presentational substitution
// of one sentinel glyph for a Lucide icon; no abstraction or polymorphic family.
//
// Some key glyphs render badly as text (the space symbol U+2294/U+2423 falls back
// to a font with off metrics, breaking cap layout). For those we render a proper
// Lucide icon instead, sized in `em` so it scales with the legend font-size.

import { Space } from 'lucide-react'

/** Sentinel the abbreviation table emits for the Space key (see keyAbbreviations). */
export const SPACE_GLYPH = '⊔'

/** Render a key glyph: substitutes a Lucide icon for known-bad text glyphs,
 *  otherwise returns the value untouched (string or existing node). */
export function glyphNode(value: React.ReactNode): React.ReactNode {
    if (value === SPACE_GLYPH) {
        return (
            <Space
                aria-label="Space"
                strokeWidth={2.5}
                style={{ width: '1.05em', height: '1.05em' }}
            />
        )
    }
    return value
}
