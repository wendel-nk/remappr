// Pattern check: no GoF pattern (-) — rejected — unit tests for pure cap-prop /
// binding-code mappings; assertions over data, no abstraction.
import { describe, expect, it } from 'vitest'
import type { CanonAction } from '@firmware/config'
import { builderBindingCode, builderCapProps } from './builderCapProps'

describe('builderCapProps', () => {
    it('renders transparent as the ▽ pass-through glyph (matches the editor)', () => {
        const legend = builderCapProps({ type: 'transparent' })
        expect(legend).toEqual({ tapText: '▽', category: 'trans' })
    })

    it('returns null only for an absent binding', () => {
        expect(builderCapProps(undefined)).toBeNull()
        expect(builderCapProps({ type: 'none' })).not.toBeNull()
    })

    it('exposes chord modifiers as deduped chips (not folded into the header)', () => {
        const legend = builderCapProps({
            type: 'key_press',
            key: 'C',
            mods: ['LEFT_CTRL', 'RIGHT_CTRL', 'LEFT_SHIFT'],
        })
        expect(legend?.header).toBe('Key Press')
        expect(legend?.mods).toEqual(['Ctrl', 'Shift'])
        expect(legend?.accentCategory).toBe('mod')
    })

    it('leaves mods undefined for an unmodified key-press', () => {
        const legend = builderCapProps({ type: 'key_press', key: 'A' })
        expect(legend?.mods).toBeUndefined()
        expect(legend?.header).toBe('Key Press')
    })
})

describe('builderBindingCode', () => {
    const cases: Array<[CanonAction, string]> = [
        [{ type: 'key_press', key: 'A' }, '&kp'],
        [{ type: 'sticky_key', key: 'LEFT_SHIFT' }, '&sk'],
        [{ type: 'layer', mode: 'momentary', layer: 'lower' }, '&mo'],
        [{ type: 'layer', mode: 'toggle', layer: 'lower' }, '&tog'],
        [{ type: 'layer', mode: 'to', layer: 'lower' }, '&to'],
        [{ type: 'layer', mode: 'sticky', layer: 'lower' }, '&sl'],
        [
            {
                type: 'tap_hold',
                tap: { type: 'key_press', key: 'A' },
                hold: { type: 'modifier', modifier: 'LEFT_CTRL' },
            },
            '&mt',
        ],
        [
            {
                type: 'tap_hold',
                tap: { type: 'key_press', key: 'A' },
                hold: { type: 'layer', layer: 'lower' },
            },
            '&lt',
        ],
        [{ type: 'macro', ref: 'my_macro' }, '&my_macro'],
        [{ type: 'output', action: 'bluetooth_next' }, '&bt'],
        [{ type: 'output', action: 'usb' }, '&out'],
        [{ type: 'lighting', target: 'backlight', action: 'toggle' }, '&bl'],
        [
            { type: 'lighting', target: 'underglow', action: 'toggle' },
            '&rgb_ug',
        ],
        [{ type: 'transparent' }, '&trans'],
        [{ type: 'none' }, '&none'],
    ]
    it.each(cases)('%o → %s', (action, token) => {
        expect(builderBindingCode(action)).toBe(token)
    })

    it('is undefined for an absent binding', () => {
        expect(builderBindingCode(undefined)).toBeUndefined()
    })

    it('defaults to ZMK tokens, switches to QMK by firmware', () => {
        const kp: CanonAction = { type: 'key_press', key: 'A' }
        const mo: CanonAction = { type: 'layer', mode: 'momentary', layer: 'l' }
        // no firmware / zmk present → ZMK tokens
        expect(builderBindingCode(kp)).toBe('&kp')
        expect(builderBindingCode(kp, ['qmk', 'zmk'])).toBe('&kp')
        // QMK-only firmware → QMK keycode prefixes
        expect(builderBindingCode(kp, ['qmk'])).toBe('KC')
        expect(builderBindingCode(mo, ['via', 'vial'])).toBe('MO')
        // ZMK-only action on QMK → undefined (header falls back to action name)
        expect(
            builderBindingCode({ type: 'soft_off' }, ['qmk']),
        ).toBeUndefined()
    })
})
