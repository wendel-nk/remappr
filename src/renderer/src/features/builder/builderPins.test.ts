// Pattern check: no GoF pattern (-) — rejected — unit tests over pure pin helpers.
import { describe, expect, it } from 'vitest'
import type { ConfigKeymap } from '@firmware/config'
import { newBoardConfig } from './geometryEditor'
import {
    addCol,
    addRow,
    colPins,
    rowPins,
    setColPin,
    setRowPin,
} from './builderPins'

// 2 rows × 3 cols grid: transform derives rows=2, cols=3 from position.
const board = (): ConfigKeymap =>
    newBoardConfig({ name: 'B', rows: 2, cols: 3, target: 'qmk' })

describe('builderPins', () => {
    it('defaults pins from the transform (rows then cols)', () => {
        const c = board()
        expect(rowPins(c)).toEqual(['GP0', 'GP1'])
        expect(colPins(c)).toEqual(['GP2', 'GP3', 'GP4'])
    })

    it('setRowPin / setColPin persist a label, keep the rest defaulted', () => {
        let c = board()
        c = setRowPin(c, 0, 'GP10')
        c = setColPin(c, 2, 'GP20')
        expect(c.keyboard.pins?.rows[0]).toBe('GP10')
        expect(rowPins(c)).toEqual(['GP10', 'GP1'])
        expect(colPins(c)).toEqual(['GP2', 'GP3', 'GP20'])
        // editing pins commits the transform so counts stay stable
        expect(c.keyboard.hardware?.transform).toMatchObject({
            rows: 2,
            columns: 3,
        })
    })

    it('blank label falls back to the default', () => {
        let c = setRowPin(board(), 1, 'GPx')
        c = setRowPin(c, 1, '   ')
        expect(rowPins(c)[1]).toBe('GP1')
    })

    it('addRow / addCol grow the transform and pin lists', () => {
        const r = addRow(board())
        expect(r.index).toBe(2)
        expect(r.config.keyboard.hardware?.transform?.rows).toBe(3)
        expect(rowPins(r.config)).toHaveLength(3)

        const co = addCol(board())
        expect(co.index).toBe(3)
        expect(co.config.keyboard.hardware?.transform?.columns).toBe(4)
        expect(colPins(co.config)).toHaveLength(4)
    })
})
