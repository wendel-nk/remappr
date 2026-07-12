// pattern-check: skip — unit test for the pure behavior-editor helpers
import { describe, expect, it } from 'vitest'

import type { CanonHoldTapDef, CanonModMorph } from '@firmware/config'
import { LimitsFeature } from '@firmware/remappr/protocol'

import {
    ALL_MODIFIERS,
    FLAVOR_OPTIONS,
    featureSupported,
    holdTapPatch,
    modMorphPatch,
    modifierLabel,
    toggleModifier,
} from './behaviorFields'

const HT: CanonHoldTapDef = {
    id: 'home-row',
    flavor: 'balanced',
    tappingTermMs: 220,
    quickTapMs: 150,
    retroTap: true,
    bindings: ['&kp', '&kp'],
}

const MM: CanonModMorph = {
    id: 'shift-del',
    mods: ['LEFT_SHIFT'],
    keepMods: ['LEFT_SHIFT'],
    bindings: [
        { type: 'key_press', key: 'key.keyboard_backspace' },
        { type: 'key_press', key: 'key.keyboard_delete_forward' },
    ],
}

describe('behavior editor helpers', () => {
    it('exposes the four flavors and eight modifiers', () => {
        expect(FLAVOR_OPTIONS).toContain('balanced')
        expect(FLAVOR_OPTIONS).toHaveLength(4)
        expect(ALL_MODIFIERS).toHaveLength(8)
    })

    it('labels modifiers on the short L/R form', () => {
        expect(modifierLabel('LEFT_CTRL')).toBe('LCtrl')
        expect(modifierLabel('RIGHT_GUI')).toBe('RGui')
    })

    it('featureSupported: undefined always; featured follows the bitmask', () => {
        expect(featureSupported(undefined, 0)).toBe(true)
        expect(featureSupported('holdTriggerOnRelease', 0)).toBe(false)
        expect(
            featureSupported(
                'holdTriggerOnRelease',
                LimitsFeature.holdTriggerOnRelease,
            ),
        ).toBe(true)
    })

    it('toggleModifier adds then removes', () => {
        expect(toggleModifier(['LEFT_SHIFT'], 'LEFT_CTRL')).toEqual([
            'LEFT_SHIFT',
            'LEFT_CTRL',
        ])
        expect(
            toggleModifier(['LEFT_SHIFT', 'LEFT_CTRL'], 'LEFT_CTRL'),
        ).toEqual(['LEFT_SHIFT'])
    })

    it('holdTapPatch returns only changed fields, else null', () => {
        expect(holdTapPatch(HT, HT)).toBeNull()
        expect(
            holdTapPatch(HT, { ...HT, tappingTermMs: 333, retroTap: false }),
        ).toEqual({ tappingTermMs: 333, retroTap: false })
        expect(holdTapPatch(HT, { ...HT, flavor: 'hold-preferred' })).toEqual({
            flavor: 'hold-preferred',
        })
    })

    it('modMorphPatch diffs mods/keepMods as sets, order-independent', () => {
        expect(modMorphPatch(MM, ['LEFT_SHIFT'], ['LEFT_SHIFT'])).toBeNull()
        expect(
            modMorphPatch(MM, ['LEFT_SHIFT', 'RIGHT_SHIFT'], ['LEFT_SHIFT']),
        ).toEqual({ mods: ['LEFT_SHIFT', 'RIGHT_SHIFT'] })
        expect(modMorphPatch(MM, ['LEFT_SHIFT'], [])).toEqual({ keepMods: [] })
    })
})
