import { describe, expect, it } from 'vitest'
import type { ConfigHardware, CanonMatrixTransform } from '@firmware/config'
import {
    EMPTY_DRAFT,
    draftToHardware,
    hardwareToDraft,
    parseGpioLines,
} from './hardwareForm'

const TRANSFORM: CanonMatrixTransform = {
    rows: 1,
    columns: 2,
    map: [
        [0, 0],
        [0, 1],
    ],
}

const MATRIX_HW: ConfigHardware = {
    board: 'nice_nano_v2',
    shield: 'corne',
    kscan: {
        type: 'matrix',
        diodeDirection: 'col2row',
        rowGpios: ['&gpio0 5 X'],
        colGpios: ['&gpio0 6 X', '&gpio0 7 X'],
        debouncePressMs: 5,
        debounceReleaseMs: 6,
    },
    transform: TRANSFORM,
}

describe('hardwareForm transforms', () => {
    it('seeds an empty draft from undefined hardware', () => {
        expect(hardwareToDraft(undefined)).toEqual(EMPTY_DRAFT)
    })

    it('parseGpioLines trims and drops blank lines', () => {
        expect(parseGpioLines('  a \n\n b \n   ')).toEqual(['a', 'b'])
    })

    it('round-trips matrix hardware through draft (transform carried through)', () => {
        const draft = hardwareToDraft(MATRIX_HW)
        expect(draft.kscanKind).toBe('matrix')
        expect(draft.rowGpios).toBe('&gpio0 5 X')
        expect(draft.colGpios).toBe('&gpio0 6 X\n&gpio0 7 X')
        expect(draft.debouncePressMs).toBe('5')
        expect(draftToHardware(draft, TRANSFORM)).toEqual(MATRIX_HW)
    })

    it('builds a direct kscan and omits the matrix-only fields', () => {
        const hw = draftToHardware({
            ...EMPTY_DRAFT,
            kscanKind: 'direct',
            inputGpios: '&gpio0 2 X\n&gpio0 3 X',
        })
        expect(hw?.kscan).toEqual({
            type: 'direct',
            inputGpios: ['&gpio0 2 X', '&gpio0 3 X'],
        })
    })

    it('returns undefined for an effectively empty draft', () => {
        expect(draftToHardware(EMPTY_DRAFT)).toBeUndefined()
    })

    it('carries a previous transform through even with no kscan', () => {
        const hw = draftToHardware({ ...EMPTY_DRAFT, board: 'b' }, TRANSFORM)
        expect(hw).toEqual({ board: 'b', transform: TRANSFORM })
    })

    it('omits invalid/blank debounce values', () => {
        const hw = draftToHardware({
            ...EMPTY_DRAFT,
            kscanKind: 'direct',
            inputGpios: '&gpio0 2 X',
            debouncePressMs: 'abc',
            debounceReleaseMs: '',
        })
        expect(hw?.kscan).toEqual({
            type: 'direct',
            inputGpios: ['&gpio0 2 X'],
        })
    })
})
