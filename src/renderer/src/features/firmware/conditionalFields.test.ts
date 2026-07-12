// pattern-check: skip — unit test for the pure conditional-layer editor helpers
import { describe, expect, it } from 'vitest'

import type { CanonConditionalLayer } from '@firmware/config'

import {
    conditionalError,
    conditionalLayersPatch,
    emptyConditional,
    sameConditional,
    sameConditionalList,
    toggleIfLayer,
} from './conditionalFields'

const LAYERS = ['base', 'raise', 'lower', 'adjust']
const TRI: CanonConditionalLayer = {
    ifLayers: ['raise', 'lower'],
    thenLayer: 'adjust',
}

describe('conditional-layer editor helpers', () => {
    it('emptyConditional is a blank row', () => {
        expect(emptyConditional()).toEqual({ ifLayers: [], thenLayer: '' })
    })

    it('toggleIfLayer adds then removes', () => {
        expect(toggleIfLayer(['raise'], 'lower')).toEqual(['raise', 'lower'])
        expect(toggleIfLayer(['raise', 'lower'], 'lower')).toEqual(['raise'])
    })

    it('sameConditional: if-set order-independent, then-layer exact', () => {
        expect(
            sameConditional(TRI, {
                ifLayers: ['lower', 'raise'],
                thenLayer: 'adjust',
            }),
        ).toBe(true)
        expect(
            sameConditional(TRI, { ifLayers: ['raise'], thenLayer: 'adjust' }),
        ).toBe(false)
        expect(
            sameConditional(TRI, {
                ifLayers: ['raise', 'lower'],
                thenLayer: 'base',
            }),
        ).toBe(false)
    })

    it('sameConditionalList: length + pairwise', () => {
        expect(
            sameConditionalList(
                [TRI],
                [{ ifLayers: ['lower', 'raise'], thenLayer: 'adjust' }],
            ),
        ).toBe(true)
        expect(sameConditionalList([TRI], [])).toBe(false)
    })

    it('conditionalLayersPatch: the list on change, null when equal', () => {
        expect(
            conditionalLayersPatch(
                [TRI],
                [{ ifLayers: ['lower', 'raise'], thenLayer: 'adjust' }],
            ),
        ).toBeNull()
        const next: CanonConditionalLayer[] = [
            TRI,
            { ifLayers: ['base'], thenLayer: 'raise' },
        ]
        expect(conditionalLayersPatch([TRI], next)).toEqual(next)
        // Empty list clears — a real change from a non-empty committed list.
        expect(conditionalLayersPatch([TRI], [])).toEqual([])
    })

    it('conditionalError: empty if-list, missing then, unknown refs', () => {
        expect(conditionalError([TRI], LAYERS)).toBeNull()
        expect(
            conditionalError([{ ifLayers: [], thenLayer: 'adjust' }], LAYERS),
        ).toMatch(/at least one/)
        expect(
            conditionalError([{ ifLayers: ['raise'], thenLayer: '' }], LAYERS),
        ).toMatch(/"then" layer/)
        expect(
            conditionalError(
                [{ ifLayers: ['ghost'], thenLayer: 'adjust' }],
                LAYERS,
            ),
        ).toMatch(/unknown layer "ghost"/)
        expect(
            conditionalError(
                [{ ifLayers: ['raise'], thenLayer: 'ghost' }],
                LAYERS,
            ),
        ).toMatch(/unknown layer "ghost"/)
    })
})
