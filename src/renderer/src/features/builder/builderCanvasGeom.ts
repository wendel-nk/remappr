// pattern-check: skip — pure geometry helpers extracted from BuilderCanvas, no abstraction
import type { CanonGeometry } from '@firmware/config'

interface Bounds {
    maxX: number
    maxY: number
}
export function boardBounds(keys: CanonGeometry[]): Bounds {
    let maxX = 0
    let maxY = 0
    for (const k of keys) {
        maxX = Math.max(maxX, k.x + k.w)
        maxY = Math.max(maxY, k.y + k.h)
    }
    return { maxX, maxY }
}

// pattern-check: skip pure full-extent bounds helper for centering, no abstraction
/** Full board extent (incl. min corner) — for centring the board in the canvas. */
export function fullBounds(keys: CanonGeometry[]): {
    minX: number
    minY: number
    maxX: number
    maxY: number
} {
    if (!keys.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const k of keys) {
        minX = Math.min(minX, k.x)
        minY = Math.min(minY, k.y)
        maxX = Math.max(maxX, k.x + k.w)
        maxY = Math.max(maxY, k.y + k.h)
    }
    return { minX, minY, maxX, maxY }
}

/** Padded canvas extent in key-units (min 4×4 board + 1u margin). */
export function computeCanvas(keys: CanonGeometry[]): {
    canvasW: number
    canvasH: number
} {
    const { maxX, maxY } = boardBounds(keys)
    return { canvasW: Math.max(maxX, 4) + 1, canvasH: Math.max(maxY, 4) + 1 }
}
