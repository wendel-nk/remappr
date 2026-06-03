import { describe, expect, it } from 'vitest'
import { serializeKeymap, parseKeymap } from '@firmware/config'
import { getCompiler } from '@firmware/config'
import type { ConfigKeymap } from '@firmware/config'
import {
    clampDim,
    gridKeys,
    newBoardConfig,
    slugifyId,
    MAX_GRID,
    addKey,
    removeKey,
    updateKey,
} from './geometryEditor'

describe('geometryEditor', () => {
    it('clamps grid dimensions into 1..MAX_GRID', () => {
        expect(clampDim(0)).toBe(1)
        expect(clampDim(3.9)).toBe(3)
        expect(clampDim(999)).toBe(MAX_GRID)
        expect(clampDim(NaN)).toBe(1)
    })

    it('lays out a row-major grid of 1u keys', () => {
        const keys = gridKeys(2, 3)
        expect(keys).toHaveLength(6)
        expect(keys[0]).toEqual({ x: 0, y: 0, w: 1, h: 1, r: 0 })
        expect(keys[3]).toEqual({ x: 0, y: 1, w: 1, h: 1, r: 0 })
        expect(keys[5]).toEqual({ x: 2, y: 1, w: 1, h: 1, r: 0 })
    })

    it('slugifies a board name into a devicetree-safe id', () => {
        expect(slugifyId('My Cool Board!')).toBe('my_cool_board')
        expect(slugifyId('  ')).toBe('board')
    })

    it('produces a valid config that round-trips through the validator', () => {
        const config = newBoardConfig({
            name: 'Grid 40',
            rows: 4,
            cols: 10,
            target: 'zmk',
        })
        expect(config.keyboard.keys).toHaveLength(40)
        expect(config.layers[0].bindings).toHaveLength(40)
        // parse(serialize(...)) must accept it (binding count == key count, etc.)
        const reparsed = parseKeymap(serializeKeymap(config))
        expect(reparsed.keyboard.keys).toHaveLength(40)
        expect(reparsed.meta.name).toBe('Grid 40')
    })

    it('a grid board compiles to a 4×10 geometry-derived transform', () => {
        const config = newBoardConfig({
            name: 'Grid 40',
            rows: 4,
            cols: 10,
            target: 'zmk',
        })
        const overlay = String(
            getCompiler('zmk')
                .compile(config)
                .files.find((f) => f.filename.endsWith('.overlay'))!.content,
        )
        expect(overlay.match(/RC\(\d+,\d+\)/g)).toHaveLength(40)
        expect(overlay).toContain('rows = <4>;')
        expect(overlay).toContain('columns = <10>;')
    })
})

describe('per-key geometry edits', () => {
    // 2×2 grid (4 keys, 1 base layer) with a hand-authored transform + combos.
    const base = (): ConfigKeymap => {
        const c = newBoardConfig({ name: 'B', rows: 2, cols: 2, target: 'zmk' })
        return {
            ...c,
            keyboard: {
                ...c.keyboard,
                hardware: {
                    transform: {
                        rows: 2,
                        columns: 2,
                        map: [
                            [0, 0],
                            [0, 1],
                            [1, 0],
                            [1, 1],
                        ],
                    },
                },
            },
            combos: [
                {
                    name: 'a',
                    keys: [1, 3],
                    action: { type: 'transparent' },
                },
                {
                    name: 'b',
                    keys: [0, 3],
                    action: { type: 'transparent' },
                },
            ],
        }
    }

    it('updateKey changes one key, leaves bindings intact', () => {
        const out = updateKey(base(), 0, { x: 5, w: 2 })
        expect(out.keyboard.keys[0]).toMatchObject({ x: 5, w: 2 })
        expect(out.keyboard.keys[1].x).toBe(1)
        expect(out.layers[0].bindings).toHaveLength(4)
    })

    it('addKey appends a key + transparent binding and drops the manual transform', () => {
        const out = addKey(base())
        expect(out.keyboard.keys).toHaveLength(5)
        expect(out.layers[0].bindings).toHaveLength(5)
        expect(out.layers[0].bindings[4]).toEqual({ type: 'transparent' })
        expect(out.keyboard.hardware).toBeUndefined() // transform-only hw dropped
        // still valid
        expect(parseKeymap(serializeKeymap(out)).keyboard.keys).toHaveLength(5)
    })

    it('removeKey drops the binding, fixes combos, and drops the transform', () => {
        const out = removeKey(base(), 1)
        expect(out.keyboard.keys).toHaveLength(3)
        expect(out.layers[0].bindings).toHaveLength(3)
        // combo 'a' referenced key 1 → removed; 'b' [0,3] → [0,2]
        expect(out.combos).toEqual([
            { name: 'b', keys: [0, 2], action: { type: 'transparent' } },
        ])
        expect(out.keyboard.hardware).toBeUndefined()
        expect(parseKeymap(serializeKeymap(out)).keyboard.keys).toHaveLength(3)
    })

    it('removeKey refuses to delete the last key', () => {
        const one = newBoardConfig({
            name: 'O',
            rows: 1,
            cols: 1,
            target: 'zmk',
        })
        expect(removeKey(one, 0)).toBe(one)
    })
})
