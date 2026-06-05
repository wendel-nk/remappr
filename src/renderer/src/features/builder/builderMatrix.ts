// Pattern check: no GoF pattern (-) — rejected — pure geometry/matrix helpers on
// CanonGeometry[] (bounds / normalize / split detection); immutable data
// transforms, no abstraction.
//
// Geometry math for the Keyboard Builder's left panel. The position→[row,col]
// derivation now lives in the config layer (firmware/config/matrix.ts) so the
// compilers share it; `autoMatrix` is re-exported here for existing callers.

import { deriveMatrix } from '@firmware/config'
import type { CanonGeometry, ConfigKeymap } from '@firmware/config'

/** Derive a [row,col]-per-key electrical transform from physical position.
 *  Re-exported from the config layer (single source of truth). */
export const autoMatrix = deriveMatrix

const r3 = (v: number): number => Math.round(v * 1000) / 1000

export interface BoardBounds {
    minX: number
    minY: number
    maxX: number
    maxY: number
    w: number
    h: number
}

/** Axis-aligned extent of a key set (in key-units). */
export function boardBounds(keys: CanonGeometry[]): BoardBounds {
    let minX = Infinity
    let minY = Infinity
    let maxX = 0
    let maxY = 0
    for (const k of keys) {
        minX = Math.min(minX, k.x)
        minY = Math.min(minY, k.y)
        maxX = Math.max(maxX, k.x + k.w)
        maxY = Math.max(maxY, k.y + k.h)
    }
    if (!keys.length) {
        minX = 0
        minY = 0
    }
    return {
        minX,
        minY,
        maxX,
        maxY,
        w: maxX - Math.min(0, minX),
        h: maxY - Math.min(0, minY),
    }
}

/** Shift a key set so its top-left bound sits at the origin (pivots too). */
export function normalizeBoard(keys: CanonGeometry[]): CanonGeometry[] {
    const b = boardBounds(keys)
    const dx = b.minX
    const dy = b.minY
    return keys.map((k) => ({
        ...k,
        x: r3(k.x - dx),
        y: r3(k.y - dy),
        ...(k.rx !== undefined ? { rx: r3(k.rx - dx) } : {}),
        ...(k.ry !== undefined ? { ry: r3(k.ry - dy) } : {}),
    }))
}

// pattern-check: skip — removed derivation now lives in firmware/config/matrix.ts
export interface MatrixDims {
    rows: number
    cols: number
}

/** Rows × columns for the board: the real transform when present, else the
 *  position-derived band count (what the user would get from "Auto"). */
export function matrixDims(config: ConfigKeymap | null): MatrixDims {
    if (!config) return { rows: 0, cols: 0 }
    const t = config.keyboard.hardware?.transform
    if (t) return { rows: t.rows, cols: t.columns }
    const keys = config.keyboard.keys
    if (!keys.length) return { rows: 0, cols: 0 }
    const auto = autoMatrix(keys)
    return { rows: auto.rows, cols: auto.columns }
}

export interface SplitInfo {
    mid: number
    gap: number
    leftCount: number
    rightCount: number
    minY: number
    maxY: number
}

/** Detect a two-piece layout by the largest horizontal gap between caps.
 *  Returns null when there's no clear (≥0.6U) divide. */
export function splitInfo(keys: CanonGeometry[]): SplitInfo | null {
    if (keys.length < 2) return null
    const edges = keys
        .map((k) => ({ l: k.x, r: k.x + k.w }))
        .sort((a, b) => a.l - b.l)
    let cover = edges[0].r
    let best = 0
    let bestMid: number | null = null
    for (let i = 1; i < edges.length; i++) {
        if (edges[i].l > cover) {
            const g = edges[i].l - cover
            if (g > best) {
                best = g
                bestMid = cover + g / 2
            }
        }
        cover = Math.max(cover, edges[i].r)
    }
    if (best < 0.6 || bestMid == null) return null
    const b = boardBounds(keys)
    return {
        mid: bestMid,
        gap: best,
        leftCount: keys.filter((k) => k.x + k.w / 2 < bestMid).length,
        rightCount: keys.filter((k) => k.x + k.w / 2 >= bestMid).length,
        minY: b.minY,
        maxY: b.maxY,
    }
}
