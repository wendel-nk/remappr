// Pattern check: no GoF pattern (-) — rejected — unit tests for QMK keycode encode/decode round-trips and label generation.
import { describe, it, expect } from 'vitest'

import {
    QMK_KIND,
    buildQmkKeyAction,
    decodeKeycode,
    encodeKeycode,
} from './actions'

describe('qmk/actions — keycode codec', () => {
    it('KC_NO encodes 0x0000', () => {
        expect(encodeKeycode(buildQmkKeyAction(QMK_KIND.NONE, []))).toBe(0x0000)
        expect(decodeKeycode(0x0000)).toEqual({
            kind: QMK_KIND.NONE,
            params: [],
        })
    })

    it('KC_TRNS encodes 0x0001', () => {
        expect(encodeKeycode(buildQmkKeyAction(QMK_KIND.TRANS, []))).toBe(
            0x0001,
        )
        expect(decodeKeycode(0x0001)).toEqual({
            kind: QMK_KIND.TRANS,
            params: [],
        })
    })

    it('basic key A (0x04) round-trips', () => {
        const a = buildQmkKeyAction(QMK_KIND.BASIC, [0x04])
        const kc = encodeKeycode(a)
        expect(kc).toBe(0x0004)
        expect(decodeKeycode(kc)).toEqual({
            kind: QMK_KIND.BASIC,
            params: [0x04],
        })
    })

    it('mod-tap LSHIFT + A round-trips', () => {
        const action = buildQmkKeyAction(QMK_KIND.MOD_TAP, [0x02, 0x04])
        const kc = encodeKeycode(action)
        // QK_MOD_TAP base 0x6000; mod 0x02 (LSHIFT) packs to 0b00010
        expect(kc).toBe(0x6000 | (0b00010 << 8) | 0x04)
        const decoded = decodeKeycode(kc)
        expect(decoded.kind).toBe(QMK_KIND.MOD_TAP)
        expect(decoded.params).toEqual([0x02, 0x04])
    })

    it('mod-tap RGUI + Space round-trips', () => {
        const action = buildQmkKeyAction(QMK_KIND.MOD_TAP, [0x80, 0x2c])
        const decoded = decodeKeycode(encodeKeycode(action))
        expect(decoded.kind).toBe(QMK_KIND.MOD_TAP)
        expect(decoded.params).toEqual([0x80, 0x2c])
    })

    it('layer-tap layer 2 + Esc round-trips', () => {
        const action = buildQmkKeyAction(QMK_KIND.LAYER_TAP, [2, 0x29])
        const kc = encodeKeycode(action)
        expect(kc).toBe(0x4000 | (2 << 8) | 0x29)
        expect(decodeKeycode(kc)).toEqual({
            kind: QMK_KIND.LAYER_TAP,
            params: [2, 0x29],
        })
    })

    it('momentary layer 3 round-trips', () => {
        const action = buildQmkKeyAction(QMK_KIND.MOMENTARY, [3])
        const kc = encodeKeycode(action)
        expect(kc).toBe(0x5103)
        expect(decodeKeycode(kc)).toEqual({
            kind: QMK_KIND.MOMENTARY,
            params: [3],
        })
    })

    it('toggle-layer 1 round-trips', () => {
        const kc = encodeKeycode(buildQmkKeyAction(QMK_KIND.TOGGLE_LAYER, [1]))
        expect(kc).toBe(0x5301)
        expect(decodeKeycode(kc)).toEqual({
            kind: QMK_KIND.TOGGLE_LAYER,
            params: [1],
        })
    })

    it('label uses layer name when available', () => {
        const action = buildQmkKeyAction(
            QMK_KIND.MOMENTARY,
            [1],
            ['Base', 'Lower'],
        )
        expect(action.label.primary).toContain('Lower')
    })

    it('label falls back to hex for unknown basic codes', () => {
        const a = buildQmkKeyAction(QMK_KIND.BASIC, [0xab])
        expect(a.label.primary).toMatch(/0xab/i)
    })
})
