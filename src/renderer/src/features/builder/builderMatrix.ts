// Pattern check: no GoF pattern (-) — rejected — pure geometry/matrix helpers on
// CanonGeometry[] (bounds / normalize / split detection); immutable data
// transforms, no abstraction.
//
// Geometry math for the Keyboard Builder's left panel. The position→[row,col]
// derivation now lives in the config layer (firmware/config/matrix.ts) so the
// compilers share it; `autoMatrix` is re-exported here for existing callers.

import type { CanonGeometry, ConfigKeymap } from '@firmware/config'
import { deriveMatrix, matrixDims as configMatrixDims } from '@firmware/config'

import { round3 } from '@/lib/clampInt'

/** Derive a [row,col]-per-key electrical transform from physical position.
 *  Re-exported from the config layer (single source of truth). */
export const autoMatrix = deriveMatrix

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

// pattern-check: skip — moved geometry helpers (keyCenter/buildRuns) from MatrixOverlay, no new abstraction
/** Pixel center of a key (in the canvas's `oneU`-scaled coordinate space). */
export function keyCenter(
    k: CanonGeometry,
    oneU: number,
): { x: number; y: number } {
    return {
        x: (k.x + k.w / 2) * oneU,
        y: (k.y + k.h / 2) * oneU,
    }
}

/** A single matrix run: a dashed path connecting every cap wired to one row/col,
 *  with an anchor point for its GPIO pin chip. */
export interface MatrixRun {
    key: string
    id: number
    anchor: { x: number; y: number }
    d: string
}

/** Group keys by their picked matrix id (row or col) and build a sorted dashed
 *  run + anchor for each. `horizontal` sorts/anchors along x (rows) vs y (cols). */
export function buildRuns(
    keys: CanonGeometry[],
    pick: (rc: [number, number]) => number,
    map: [number, number][],
    oneU: number,
    horizontal: boolean,
): MatrixRun[] {
    const groups = new Map<number, CanonGeometry[]>()
    keys.forEach((k, i) => {
        const rc = map[i]
        if (!rc) return
        const id = pick(rc)
        const list = groups.get(id) ?? []
        list.push(k)
        groups.set(id, list)
    })
    const GAP = oneU * 1.05
    return [...groups.entries()].map(([id, arr]) => {
        const sorted = [...arr].sort((a, b) =>
            horizontal ? a.x - b.x : a.y - b.y,
        )
        const c0 = keyCenter(sorted[0], oneU)
        const anchor = horizontal
            ? { x: c0.x - GAP, y: c0.y }
            : { x: c0.x, y: c0.y - GAP }
        const line = sorted
            .map((k) => {
                const c = keyCenter(k, oneU)
                return `L${c.x.toFixed(1)} ${c.y.toFixed(1)}`
            })
            .join(' ')
        return {
            key: (horizontal ? 'r' : 'c') + id,
            id,
            anchor,
            d: `M${anchor.x.toFixed(1)} ${anchor.y.toFixed(1)} ${line}`,
        }
    })
}

/** Shift a key set so its top-left bound sits at the origin (pivots too). */
export function normalizeBoard(keys: CanonGeometry[]): CanonGeometry[] {
    const b = boardBounds(keys)
    const dx = b.minX
    const dy = b.minY
    return keys.map((k) => ({
        ...k,
        x: round3(k.x - dx),
        y: round3(k.y - dy),
        ...(k.rx !== undefined ? { rx: round3(k.rx - dx) } : {}),
        ...(k.ry !== undefined ? { ry: round3(k.ry - dy) } : {}),
    }))
}

// pattern-check: skip — removed derivation now lives in firmware/config/matrix.ts
export interface MatrixDims {
    rows: number
    cols: number
}

/** Rows × columns for the board, from `keys[].matrix` + the board descriptor +
 *  pin floors (see the config layer's `matrixDims`); zero for a null config. */
export function matrixDims(config: ConfigKeymap | null): MatrixDims {
    if (!config) return { rows: 0, cols: 0 }
    return configMatrixDims(config)
}

export interface DisplayMatrixDims extends MatrixDims {
    /** True when `rows`/`cols` describe one half of a split board (each half is
     *  wired to its own controller), so the UI can label it "per half". */
    perHalf: boolean
}

// pattern-check: skip — split-aware label helper composing matrixDims/splitInfo/deriveMatrix, no abstraction
/** Rows × columns to *show* in the builder. The internal `matrixDims` reports the
 *  unified grid (left + right halves concatenated, e.g. 4×12 for a Corne) because
 *  pin-mapping and per-key editing index into one matrix. But a split is two
 *  independent matrices, so each half is really 4×6 — that's what a user expects
 *  to see. When the board is split, this derives the larger half's own dims and
 *  flags `perHalf`; otherwise it's the unified dims with `perHalf: false`. */
export function displayMatrixDims(
    config: ConfigKeymap | null,
): DisplayMatrixDims {
    const unified = matrixDims(config)
    if (!config?.keyboard.split) return { ...unified, perHalf: false }
    const keys = config.keyboard.keys
    const split = splitInfo(keys)
    if (!split) return { ...unified, perHalf: false }
    const halves = [
        keys.filter((k) => k.x + k.w / 2 < split.mid),
        keys.filter((k) => k.x + k.w / 2 >= split.mid),
    ]
    let rows = 0
    let cols = 0
    for (const half of halves) {
        if (!half.length) continue
        const m = deriveMatrix(half)
        rows = Math.max(rows, m.rows)
        cols = Math.max(cols, m.columns)
    }
    if (!rows || !cols) return { ...unified, perHalf: false }
    return { rows, cols, perHalf: true }
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
