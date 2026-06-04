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
    updateKeys,
    duplicateKeys,
    removeKeys,
    snap,
    addEncoder,
    updateEncoder,
    removeEncoder,
    addLayer,
    renameLayer,
    duplicateLayer,
    removeLayer,
    replaceGeometry,
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

    it('updateKeys maps selected keys, leaves bindings + transform untouched', () => {
        const out = updateKeys(base(), (k, i) =>
            i === 0 || i === 2 ? { ...k, x: k.x + 5 } : k,
        )
        expect(out.keyboard.keys[0].x).toBe(5)
        expect(out.keyboard.keys[2].x).toBe(5)
        expect(out.keyboard.keys[1].x).toBe(1)
        expect(out.layers[0].bindings).toHaveLength(4)
        // pure move keeps the hand-authored transform (positions don't break RC())
        expect(out.keyboard.hardware?.transform).toBeDefined()
    })

    it('duplicateKeys appends offset copies + transparent bindings', () => {
        const { config: out, newIndices } = duplicateKeys(base(), [0, 1])
        expect(out.keyboard.keys).toHaveLength(6)
        expect(newIndices).toEqual([4, 5])
        expect(out.keyboard.keys[4]).toMatchObject({ x: 0.25, y: 0.25 })
        expect(out.layers[0].bindings).toHaveLength(6)
        expect(out.layers[0].bindings[4]).toEqual({ type: 'transparent' })
        expect(out.keyboard.hardware).toBeUndefined() // structural edit drops transform
        expect(parseKeymap(serializeKeymap(out)).keyboard.keys).toHaveLength(6)
    })

    it('removeKeys drops several keys + bindings and remaps combos', () => {
        const out = removeKeys(base(), [0, 1])
        expect(out.keyboard.keys).toHaveLength(2)
        expect(out.layers[0].bindings).toHaveLength(2)
        // combo 'a' [1,3] → key 1 dropped → removed; 'b' [0,3] → key 0 dropped → removed
        expect(out.combos).toEqual([])
        expect(parseKeymap(serializeKeymap(out)).keyboard.keys).toHaveLength(2)
    })

    it('removeKeys refuses to empty the board', () => {
        const b = base()
        expect(removeKeys(b, [0, 1, 2, 3])).toBe(b)
    })
})

describe('snap', () => {
    it('quantizes to the nearest step without float dust', () => {
        expect(snap(0.31, 0.25)).toBe(0.25)
        expect(snap(0.4, 0.25)).toBe(0.5)
        expect(snap(0.3, 0.1)).toBe(0.3) // would be 0.30000000000000004 unrounded
        expect(snap(2.6, 1)).toBe(3)
    })

    it('returns the value unchanged for a non-positive step', () => {
        expect(snap(1.234, 0)).toBe(1.234)
    })
})

describe('encoder slots', () => {
    const base = (): ConfigKeymap =>
        newBoardConfig({ name: 'E', rows: 1, cols: 2, target: 'zmk' })

    it('addEncoder appends a slot, defaulting to the origin', () => {
        const out = addEncoder(base())
        expect(out.keyboard.encoders).toEqual([{ x: 0, y: 0 }])
        const out2 = addEncoder(out, { x: 2, y: 1 })
        expect(out2.keyboard.encoders).toEqual([
            { x: 0, y: 0 },
            { x: 2, y: 1 },
        ])
        expect(
            parseKeymap(serializeKeymap(out2)).keyboard.encoders,
        ).toHaveLength(2)
    })

    it('updateEncoder moves one slot, leaves others intact', () => {
        const out = updateEncoder(
            addEncoder(addEncoder(base()), { x: 1, y: 0 }),
            1,
            {
                x: 3,
            },
        )
        expect(out.keyboard.encoders).toEqual([
            { x: 0, y: 0 },
            { x: 3, y: 0 },
        ])
    })

    it('removeEncoder splices the slot and its aligned per-layer binding', () => {
        const seeded: ConfigKeymap = {
            ...addEncoder(addEncoder(base())),
            keyboard: {
                ...addEncoder(addEncoder(base())).keyboard,
            },
            layers: base().layers.map((l) => ({
                ...l,
                encoders: [
                    {
                        cw: { type: 'transparent' },
                        ccw: { type: 'transparent' },
                    },
                    {
                        cw: { type: 'transparent' },
                        ccw: { type: 'transparent' },
                    },
                ],
            })),
        }
        const out = removeEncoder(seeded, 0)
        expect(out.keyboard.encoders).toEqual([{ x: 0, y: 0 }])
        expect(out.layers[0].encoders).toHaveLength(1)
    })

    it('removeEncoder drops the encoders field when the last slot goes', () => {
        const out = removeEncoder(addEncoder(base()), 0)
        expect(out.keyboard.encoders).toBeUndefined()
    })

    it('removeEncoder is a no-op for an out-of-range index', () => {
        const seeded = addEncoder(base())
        expect(removeEncoder(seeded, 5)).toBe(seeded)
    })
})

describe('layer + geometry-replace editors', () => {
    const base = (): ConfigKeymap =>
        newBoardConfig({ name: 'B', rows: 2, cols: 3, target: 'zmk' })

    it('addLayer appends a layer with transparent bindings sized to the board', () => {
        const out = addLayer(base())
        expect(out.layers).toHaveLength(2)
        expect(out.layers[1].name).toBe('layer_1')
        expect(out.layers[1].bindings).toHaveLength(6)
        expect(
            out.layers[1].bindings.every((b) => b.type === 'transparent'),
        ).toBe(true)
    })

    it('addLayer sizes encoder bindings to the board encoders', () => {
        const out = addLayer(addEncoder(base()))
        expect(out.layers.at(-1)?.encoders).toHaveLength(1)
    })

    it('renameLayer renames in place, ignores blank names', () => {
        expect(renameLayer(base(), 0, 'Nav').layers[0].name).toBe('Nav')
        expect(renameLayer(base(), 0, '   ').layers[0].name).toBe('base')
    })

    it('duplicateLayer inserts a copy right after the source', () => {
        const seed = renameLayer(base(), 0, 'Base')
        const { config: out, newIndex } = duplicateLayer(seed, 0)
        expect(newIndex).toBe(1)
        expect(out.layers).toHaveLength(2)
        expect(out.layers[1].name).toBe('Base copy')
        expect(out.layers[1].bindings).toHaveLength(6)
    })

    it('removeLayer drops a layer but never leaves zero', () => {
        const two = addLayer(base())
        expect(removeLayer(two, 0).layers).toHaveLength(1)
        const one = base()
        expect(removeLayer(one, 0)).toBe(one)
    })

    it('replaceGeometry swaps keys, keeps layer names, resets bindings + drops transform', () => {
        const seed = {
            ...renameLayer(addLayer(base()), 0, 'Base'),
        }
        const withHw: ConfigKeymap = {
            ...seed,
            keyboard: {
                ...seed.keyboard,
                encoders: [{ x: 0, y: 0 }],
                hardware: {
                    transform: {
                        rows: 2,
                        columns: 3,
                        map: seed.keyboard.keys.map(
                            () => [0, 0] as [number, number],
                        ),
                    },
                },
            },
        }
        const out = replaceGeometry(withHw, gridKeys(1, 4))
        expect(out.keyboard.keys).toHaveLength(4)
        expect(out.keyboard.encoders).toBeUndefined()
        expect(out.keyboard.hardware?.transform).toBeUndefined()
        expect(out.layers.map((l) => l.name)).toEqual(['Base', 'layer_1'])
        expect(out.layers[0].bindings).toHaveLength(4)
        expect(
            out.layers[1].bindings.every((b) => b.type === 'transparent'),
        ).toBe(true)
    })
})
