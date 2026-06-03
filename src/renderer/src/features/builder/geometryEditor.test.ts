import { describe, expect, it } from 'vitest'
import { serializeKeymap, parseKeymap } from '@firmware/config'
import { getCompiler } from '@firmware/config'
import {
    clampDim,
    gridKeys,
    newBoardConfig,
    slugifyId,
    MAX_GRID,
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
