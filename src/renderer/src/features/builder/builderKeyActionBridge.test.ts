// Pattern check: no GoF pattern (-) — rejected — round-trip unit tests over the
// pure KeyAction↔CanonAction bridge; assertions on data, no abstraction.
import { describe, expect, it } from 'vitest'
import { resolveKeycode } from '@firmware/config'
import type { CanonAction } from '@firmware/config'
import {
    canonToKeyAction,
    keyActionToCanon,
    type BridgeContext,
} from './builderKeyActionBridge'

const ctx: BridgeContext = {
    layerNames: ['base', 'lower', 'raise'],
    macroIds: ['m0', 'm1'],
    tapDanceIds: ['td0'],
}

const A = resolveKeycode('A')!
const C = resolveKeycode('C')!
const SPACE = resolveKeycode('Space')!

const roundtrip = (a: CanonAction): CanonAction | null => {
    const ka = canonToKeyAction(a, ctx)
    return keyActionToCanon(ka.kind, ka.params, ctx)
}

describe('builderKeyActionBridge — round-trips', () => {
    const cases: CanonAction[] = [
        { type: 'key_press', key: A },
        { type: 'key_press', key: C, mods: ['LEFT_CTRL'] },
        {
            type: 'tap_hold',
            tap: { type: 'key_press', key: A },
            hold: { type: 'modifier', modifier: 'LEFT_SHIFT' },
            _preset: 'mod_tap',
        },
        {
            type: 'tap_hold',
            tap: { type: 'key_press', key: SPACE },
            hold: { type: 'layer', layer: 'lower' },
            _preset: 'layer_tap',
        },
        { type: 'layer', mode: 'momentary', layer: 'lower' },
        { type: 'layer', mode: 'toggle', layer: 'raise' },
        { type: 'sticky_key', key: A },
        { type: 'macro', ref: 'm1' },
        { type: 'tap_dance', ref: 'td0' },
        { type: 'output', action: 'bluetooth', profile: 2 },
        { type: 'output', action: 'toggle' },
        { type: 'ext_power', action: 'off' },
        { type: 'lighting', target: 'underglow', action: 'hue_up' },
        { type: 'mouse_key', button: 'right' },
        { type: 'mouse_scroll', direction: 'down' },
        { type: 'caps_word' },
        { type: 'bootloader' },
        { type: 'key_repeat' },
    ]

    it('canon → KeyAction → canon reproduces each action', () => {
        for (const a of cases) expect(roundtrip(a)).toEqual(a)
    })

    it('empty / transparent seeds an unfilled Key Press', () => {
        expect(canonToKeyAction(undefined, ctx)).toMatchObject({
            kind: 'key_press',
            params: [],
        })
        expect(canonToKeyAction({ type: 'transparent' }, ctx)).toMatchObject({
            kind: 'key_press',
            params: [],
        })
    })

    it('keyActionToCanon returns null for incomplete drafts', () => {
        expect(keyActionToCanon('key_press', [], ctx)).toBeNull()
        expect(keyActionToCanon('key_press', [0], ctx)).toBeNull()
        expect(keyActionToCanon('mod_tap', [0], ctx)).toBeNull() // no hold
        expect(keyActionToCanon('macro', [99], ctx)).toBeNull() // bad ref
    })

    it('key+modifier packs into the grid value format', () => {
        const ka = canonToKeyAction(
            { type: 'key_press', key: C, mods: ['LEFT_CTRL', 'LEFT_SHIFT'] },
            ctx,
        )
        // modifier flags live in the top byte
        expect((ka.params[0] >>> 24) & 0xff).toBe(0b11)
    })
})
