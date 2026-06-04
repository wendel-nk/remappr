// Pattern check: no GoF pattern (-) — rejected — pure geometry/matrix helpers on
// CanonGeometry[] (bounds / normalize / band-derived matrix / split detection);
// immutable data transforms ported from the prototype BuilderData.jsx, no abstraction.
//
// Geometry math for the Keyboard Builder's left panel, ported 1:1 from
// app/builder/BuilderData.jsx (boardBounds / normalizeBoard / autoMatrix /
// matrixDims / splitInfo). Production keeps the real electrical wiring in
// `keyboard.hardware.transform` (a [row,col] per key); these helpers either read
// that transform or, when it's absent, derive a row/col matrix from the physical
// position of each cap (rounding to ⅛U bands).

import type {
    CanonGeometry,
    CanonMatrixTransform,
    ConfigKeymap,
} from '@firmware/config'

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

/** Distinct sorted ⅛U bands of a coordinate accessor across all keys. */
const bands = (
    keys: CanonGeometry[],
    pick: (k: CanonGeometry) => number,
): number[] =>
    [...new Set(keys.map((k) => Math.round(pick(k) * 4)))].sort((a, b) => a - b)

/** Split a key set into left→right column groups separated by a clear (≥`gapU`)
 *  horizontal gap. Each group is the list of original indices it contains; a
 *  contiguous board yields one group, a split board (Corne) yields one per half.
 *  Generalizes to N pieces. */
function columnGroups(keys: CanonGeometry[], gapU = 0.6): number[][] {
    const order = keys.map((_k, i) => i).sort((a, b) => keys[a].x - keys[b].x)
    const groups: number[][] = []
    let cur: number[] = []
    let cover = -Infinity
    for (const i of order) {
        const k = keys[i]
        if (cur.length && k.x > cover + gapU) {
            groups.push(cur)
            cur = []
        }
        cur.push(i)
        cover = Math.max(cover, k.x + k.w)
    }
    if (cur.length) groups.push(cur)
    return groups
}

interface LocalMatrix {
    rows: number
    columns: number
    map: [number, number][]
}

/** Wire one contiguous cluster of keys to a [row,col] grid. Picks the cleaner
 *  banding axis so staggered layouts wire sensibly:
 *   • column-staggered (Corne) — keys align in X but stagger in Y, so columns =
 *     X bands and each key's row = its rank top→bottom *within its column*.
 *   • row-staggered (60% ANSI) — keys align in Y, so rows = Y bands and each
 *     key's column = its rank left→right *within its row*.
 *  Ranking within the cross axis (instead of banding it globally) is what keeps a
 *  column-staggered board from inflating into one row per stagger offset. */
function localMatrix(keys: CanonGeometry[]): LocalMatrix {
    if (!keys.length) return { rows: 1, columns: 1, map: [] }
    const xb = bands(keys, (k) => k.x)
    const yb = bands(keys, (k) => k.y)
    // Fewer X bands than Y bands ⇒ keys line up in columns ⇒ column-major.
    const colMajor = xb.length <= yb.length
    const primary = colMajor ? xb : yb
    const primaryOf = (k: CanonGeometry): number =>
        Math.max(0, primary.indexOf(Math.round((colMajor ? k.x : k.y) * 4)))
    // Bucket keys by their primary band, then rank within each bucket along the
    // cross axis to get the secondary index.
    const buckets = new Map<number, number[]>()
    keys.forEach((k, i) => {
        const p = primaryOf(k)
        const list = buckets.get(p) ?? []
        list.push(i)
        buckets.set(p, list)
    })
    const map: [number, number][] = new Array(keys.length)
    let crossMax = 1
    for (const [p, idxs] of buckets) {
        const ranked = [...idxs].sort((a, b) =>
            colMajor ? keys[a].y - keys[b].y : keys[a].x - keys[b].x,
        )
        crossMax = Math.max(crossMax, ranked.length)
        ranked.forEach((i, rank) => {
            map[i] = colMajor ? [rank, p] : [p, rank]
        })
    }
    return colMajor
        ? { rows: crossMax, columns: primary.length, map }
        : { rows: primary.length, columns: crossMax, map }
}

/** Derive a [row, col]-per-key electrical transform from physical position.
 *  Split-aware (each piece wired independently, columns offset so the right half
 *  continues the left's numbering, rows shared) and stagger-aware (see
 *  `localMatrix`). Output `map` is index-aligned to the input key order. */
export function autoMatrix(keys: CanonGeometry[]): CanonMatrixTransform {
    if (!keys.length) return { rows: 1, columns: 1, map: [] }
    const groups = columnGroups(keys)
    const map: [number, number][] = new Array(keys.length)
    let colOffset = 0
    let rowMax = 1
    for (const group of groups) {
        const sub = group.map((i) => keys[i])
        const local = localMatrix(sub)
        group.forEach((origIdx, j) => {
            const [r, c] = local.map[j]
            map[origIdx] = [r, c + colOffset]
        })
        colOffset += local.columns
        rowMax = Math.max(rowMax, local.rows)
    }
    return { rows: rowMax, columns: Math.max(1, colOffset), map }
}

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
