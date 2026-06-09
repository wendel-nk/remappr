// Pattern check: no GoF pattern (-) — rejected — unit tests for pure geometry/
// matrix helpers; assertions over data transforms, no abstraction.
import { describe, expect, it } from 'vitest'
import { newBoardConfig } from './geometryEditor'
import {
    autoMatrix,
    boardBounds,
    matrixDims,
    normalizeBoard,
    splitInfo,
} from './builderMatrix'
import type { CanonGeometry, ConfigKeymap } from '@firmware/config'

const k = (o: Partial<CanonGeometry>): CanonGeometry => ({
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    r: 0,
    ...o,
})

describe('builderMatrix', () => {
    it('boardBounds returns the axis-aligned extent', () => {
        const b = boardBounds([k({ x: 1, y: 2 }), k({ x: 3, y: 0, w: 2 })])
        expect(b).toMatchObject({ minX: 1, minY: 0, maxX: 5, maxY: 3 })
    })

    it('normalizeBoard shifts the top-left bound to the origin', () => {
        const out = normalizeBoard([k({ x: 2, y: 1 }), k({ x: 4, y: 3 })])
        expect(out[0]).toMatchObject({ x: 0, y: 0 })
        expect(out[1]).toMatchObject({ x: 2, y: 2 })
    })

    it('normalizeBoard shifts rotation pivots too', () => {
        const out = normalizeBoard([k({ x: 2, y: 2, r: 10, rx: 2.5, ry: 2.5 })])
        expect(out[0]).toMatchObject({ x: 0, y: 0, rx: 0.5, ry: 0.5 })
    })

    it('autoMatrix derives row/col bands from physical position', () => {
        // 2 rows × 3 cols ortho grid.
        const keys: CanonGeometry[] = []
        for (let y = 0; y < 2; y++)
            for (let x = 0; x < 3; x++) keys.push(k({ x, y }))
        const t = autoMatrix(keys)
        expect(t.rows).toBe(2)
        expect(t.columns).toBe(3)
        expect(t.map).toEqual([
            [0, 0],
            [0, 1],
            [0, 2],
            [1, 0],
            [1, 1],
            [1, 2],
        ])
    })

    it('autoMatrix keeps a column-staggered split at row count (no inflation)', () => {
        // Two halves of 2 columns × 3 rows, each column staggered in Y, with a
        // clear gap between the halves — a mini Corne. Naive Y-banding would see
        // ~6 distinct rows per half; correct wiring is 3 rows.
        const stag = [0, 0.25]
        const keys: CanonGeometry[] = []
        const order: Array<[number, number, 'L' | 'R']> = []
        for (let c = 0; c < 2; c++)
            for (let row = 0; row < 3; row++) {
                keys.push(k({ x: c, y: row + stag[c] }))
                order.push([row, c, 'L'])
            }
        for (let c = 0; c < 2; c++)
            for (let row = 0; row < 3; row++) {
                keys.push(k({ x: 6 + c, y: row + stag[c] }))
                order.push([row, c, 'R'])
            }
        const t = autoMatrix(keys)
        expect(t.rows).toBe(3)
        expect(t.columns).toBe(4) // left cols 0-1, right cols 2-3
        t.map.forEach((rc, i) => {
            const [row, c, side] = order[i]
            expect(rc[0]).toBe(row) // row shared across halves
            expect(rc[1]).toBe(side === 'L' ? c : 2 + c) // right half offset
        })
    })

    it('autoMatrix wires a row-staggered board by Y rows', () => {
        // Two rows offset in X (60%-style). Rows from Y bands, cols ranked in row.
        const keys = [
            k({ x: 0, y: 0 }),
            k({ x: 1, y: 0 }),
            k({ x: 0.5, y: 1 }),
            k({ x: 1.5, y: 1 }),
        ]
        const t = autoMatrix(keys)
        expect(t.rows).toBe(2)
        expect(t.columns).toBe(2)
        expect(t.map).toEqual([
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
        ])
    })

    it('matrixDims reads the committed transform when present', () => {
        const cfg: ConfigKeymap = {
            ...newBoardConfig({ name: 'B', rows: 2, cols: 2, target: 'zmk' }),
        }
        const withT: ConfigKeymap = {
            ...cfg,
            keyboard: {
                ...cfg.keyboard,
                hardware: { transform: { rows: 5, columns: 7, map: [] } },
            },
        }
        expect(matrixDims(withT)).toEqual({ rows: 5, cols: 7 })
    })

    it('matrixDims falls back to position bands without a transform', () => {
        const cfg = newBoardConfig({
            name: 'B',
            rows: 3,
            cols: 4,
            target: 'zmk',
        })
        expect(matrixDims(cfg)).toEqual({ rows: 3, cols: 4 })
    })

    it('matrixDims is zero for a null config', () => {
        expect(matrixDims(null)).toEqual({ rows: 0, cols: 0 })
    })

    it('splitInfo detects a clear two-piece gap', () => {
        const left = [k({ x: 0 }), k({ x: 1 }), k({ x: 2 })]
        const right = [k({ x: 6 }), k({ x: 7 }), k({ x: 8 })]
        const info = splitInfo([...left, ...right])
        expect(info).not.toBeNull()
        expect(info!.leftCount).toBe(3)
        expect(info!.rightCount).toBe(3)
        expect(info!.gap).toBeGreaterThanOrEqual(0.6)
    })

    it('splitInfo returns null for a contiguous board', () => {
        const keys = [k({ x: 0 }), k({ x: 1 }), k({ x: 2 })]
        expect(splitInfo(keys)).toBeNull()
    })
})
