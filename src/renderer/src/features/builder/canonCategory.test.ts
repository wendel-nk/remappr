// Pattern check: no GoF pattern (-) — rejected — unit tests for the pure
// CanonAction category classifiers; assertions over data, no abstraction.
import { describe, expect, it } from 'vitest'
import type { CanonAction } from '@firmware/config'
import {
    accentCategoryForCanonAction,
    categoryForCanonAction,
} from './canonCategory'
import { builderCapProps } from './builderCapProps'

describe('categoryForCanonAction (face)', () => {
    it('classifies a letter key-press as alpha', () => {
        expect(categoryForCanonAction({ type: 'key_press', key: 'A' })).toBe(
            'alpha',
        )
    })

    it('follows the TAP key for a tap-hold (home-row mod stays neutral)', () => {
        const a: CanonAction = {
            type: 'tap_hold',
            tap: { type: 'key_press', key: 'A' },
            hold: { type: 'modifier', modifier: 'LEFT_GUI' },
        }
        expect(categoryForCanonAction(a)).toBe('alpha')
    })

    it('tints whole-cap function keys (layer/mouse/system/edit)', () => {
        expect(
            categoryForCanonAction({
                type: 'layer',
                mode: 'momentary',
                layer: 'lower',
            }),
        ).toBe('layer')
        expect(
            categoryForCanonAction({ type: 'mouse_key', button: 'left' }),
        ).toBe('mouse')
        expect(categoryForCanonAction({ type: 'macro', ref: 'm_hi' })).toBe(
            'system',
        )
        expect(categoryForCanonAction({ type: 'key_repeat' })).toBe('edit')
        expect(categoryForCanonAction({ type: 'caps_word' })).toBe('mod')
    })

    it('treats transparent/none as pass-through and undefined as system', () => {
        expect(categoryForCanonAction({ type: 'transparent' })).toBe('trans')
        expect(categoryForCanonAction({ type: 'none' })).toBe('trans')
        expect(categoryForCanonAction(undefined)).toBe('system')
    })
})

describe('accentCategoryForCanonAction', () => {
    it('accents a modified key-press but not a bare one', () => {
        expect(
            accentCategoryForCanonAction({
                type: 'key_press',
                key: 'C',
                mods: ['LEFT_CTRL'],
            }),
        ).toBe('mod')
        expect(
            accentCategoryForCanonAction({ type: 'key_press', key: 'A' }),
        ).toBeUndefined()
    })

    it('reads a mod-tap as mod and a layer-tap as layer', () => {
        const modTap: CanonAction = {
            type: 'tap_hold',
            tap: { type: 'key_press', key: 'A' },
            hold: { type: 'modifier', modifier: 'LEFT_GUI' },
        }
        const layerTap: CanonAction = {
            type: 'tap_hold',
            tap: { type: 'key_press', key: 'SPACE' },
            hold: { type: 'layer', layer: 'raise' },
        }
        expect(accentCategoryForCanonAction(modTap)).toBe('mod')
        expect(accentCategoryForCanonAction(layerTap)).toBe('layer')
    })

    it('accents a sticky key as mod, leaves plain function keys unaccented', () => {
        expect(
            accentCategoryForCanonAction({
                type: 'sticky_key',
                key: 'LEFT_GUI',
            }),
        ).toBe('mod')
        expect(
            accentCategoryForCanonAction({
                type: 'layer',
                mode: 'toggle',
                layer: 'fn',
            }),
        ).toBeUndefined()
    })
})

describe('builderCapProps delegates to the classifiers (parity)', () => {
    const samples: CanonAction[] = [
        { type: 'transparent' },
        { type: 'none' },
        { type: 'key_press', key: 'A' },
        { type: 'key_press', key: 'C', mods: ['LEFT_CTRL'] },
        { type: 'sticky_key', key: 'LEFT_SHIFT' },
        {
            type: 'tap_hold',
            tap: { type: 'key_press', key: 'F' },
            hold: { type: 'modifier', modifier: 'LEFT_SHIFT' },
        },
        { type: 'layer', mode: 'momentary', layer: 'lower' },
        { type: 'macro', ref: 'm_hi' },
        { type: 'mouse_key', button: 'left' },
        { type: 'caps_word' },
        { type: 'key_repeat' },
        { type: 'bootloader' },
    ]

    it('reports the same face + accent as the standalone classifiers', () => {
        for (const a of samples) {
            const legend = builderCapProps(a)
            expect(legend?.category).toBe(categoryForCanonAction(a))
            expect(legend?.accentCategory).toBe(accentCategoryForCanonAction(a))
        }
    })
})
