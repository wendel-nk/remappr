// Pattern check: no GoF pattern (-) — rejected — pure numeric KeyAction ↔
// CanonAction codec reusing mockCodec + the shared enum tables; data transforms,
// no abstraction.
//
// The builder feeds the editor's `KeyActionPicker`, which speaks the neutral
// numeric `KeyAction { kind, params: number[] }`. The config stores firmware-
// neutral `CanonAction`. This bridges the two:
//   • canonToKeyAction — seed the picker from the current binding.
//   • keyActionToCanon — turn the picker's emitted draft back into a CanonAction.
// Keycodes encode through the HID-usage `mockCodec` (same one the grid uses, so
// values line up); the keycode-grid's "(modFlags<<24) | hidValue" packing is
// honoured so a key+modifiers round-trips. Layer / modifier / enum / ref slots
// use the encodings defined in builderActionTypes (the two files share tables).

import { mockCodec } from '@firmware/mock/codec'
import { MODIFIERS } from '@firmware/config'
import type { CanonAction, Modifier } from '@firmware/config'
import type { KeyAction } from '@firmware/types'
import { ENUM_ACTIONS, type EnumKind } from './builderActionTypes'

/** Lookup context: names/refs resolve slot indices ↔ config entities. */
export interface BridgeContext {
    layerNames: string[]
    macroIds: string[]
    tapDanceIds: string[]
}

const HID_MASK = 0x00ffffff

const encodeMods = (mods: Modifier[] | undefined): number =>
    (mods ?? []).reduce((f, m) => f | (1 << MODIFIERS.indexOf(m)), 0)

const decodeMods = (flags: number): Modifier[] =>
    MODIFIERS.filter((_, i) => (flags >> i) & 1)

/** key (+ optional mods) → the grid's packed value, or 0 if unencodable. */
const encodeKey = (key: string, mods?: Modifier[]): number => {
    const base = mockCodec.encode(key)?.value
    if (base === undefined) return 0
    return (base & HID_MASK) | (encodeMods(mods) << 24)
}

/** packed value → { key, mods }, or null if the base usage is unknown. */
const decodeKey = (value: number): { key: string; mods: Modifier[] } | null => {
    const base = value & HID_MASK
    const id = mockCodec.decode(base)?.canonicalId
    if (!id) return null
    return { key: id, mods: decodeMods((value >>> 24) & 0xff) }
}

const enumKindFor = (a: CanonAction): EnumKind | null => {
    switch (a.type) {
        case 'output':
            return 'output'
        case 'ext_power':
            return 'ext_power'
        case 'lighting':
            return 'lighting'
        case 'mouse_key':
        case 'mouse_move':
        case 'mouse_scroll':
            return 'mouse'
        default:
            return null
    }
}

const NULLARY = new Set<CanonAction['type']>([
    'caps_word',
    'transparent',
    'none',
    'bootloader',
    'reset',
    'soft_off',
    'studio_unlock',
    'grave_escape',
    'key_repeat',
])

const LAYER_KIND: Record<string, string> = {
    momentary: 'layer_momentary',
    toggle: 'layer_toggle',
    to: 'layer_to',
    sticky: 'layer_sticky',
}
const LAYER_MODE: Record<string, 'momentary' | 'toggle' | 'to' | 'sticky'> = {
    layer_momentary: 'momentary',
    layer_toggle: 'toggle',
    layer_to: 'to',
    layer_sticky: 'sticky',
}

const blankLabel = { primary: '' }

/** Seed a KeyAction (kind + numeric params) from a binding. Empty / transparent
 *  seeds an unfilled Key Press so the picker opens on the common case. */
export function canonToKeyAction(
    a: CanonAction | undefined,
    ctx: BridgeContext,
): KeyAction {
    const ka = (kind: string, params: number[]): KeyAction => ({
        kind,
        params,
        label: blankLabel,
    })
    if (!a || a.type === 'transparent') return ka('key_press', [])

    switch (a.type) {
        case 'key_press':
            return ka('key_press', [encodeKey(a.key, a.mods)])
        case 'sticky_key':
            return ka('sticky_key', [encodeKey(a.key)])
        case 'tap_hold':
            return a.hold.type === 'modifier'
                ? ka('mod_tap', [
                      encodeKey(a.tap.key, a.tap.mods),
                      Math.max(0, MODIFIERS.indexOf(a.hold.modifier)),
                  ])
                : ka('layer_tap', [
                      encodeKey(a.tap.key, a.tap.mods),
                      Math.max(0, ctx.layerNames.indexOf(a.hold.layer)),
                  ])
        case 'layer':
            return ka(LAYER_KIND[a.mode] ?? 'layer_momentary', [
                Math.max(0, ctx.layerNames.indexOf(a.layer)),
            ])
        case 'macro':
            return ka('macro', [Math.max(0, ctx.macroIds.indexOf(a.ref))])
        case 'tap_dance':
            return ka('tap_dance', [
                Math.max(0, ctx.tapDanceIds.indexOf(a.ref)),
            ])
        default: {
            const ek = enumKindFor(a)
            if (ek) {
                const match = ENUM_ACTIONS[ek].find(
                    (d) => JSON.stringify(d.action) === JSON.stringify(a),
                )
                return ka(ek, [match?.value ?? 0])
            }
            // nullary system actions reuse their CanonAction type as the kind.
            return ka(a.type, [])
        }
    }
}

/** Turn a picker draft (kind + numeric params) back into a CanonAction, or null
 *  when a required slot is empty / unresolved (caller skips the commit). */
export function keyActionToCanon(
    kind: string,
    params: number[],
    ctx: BridgeContext,
): CanonAction | null {
    switch (kind) {
        case 'key_press': {
            const k = decodeKey(params[0] ?? 0)
            if (!k) return null
            return k.mods.length
                ? { type: 'key_press', key: k.key, mods: k.mods }
                : { type: 'key_press', key: k.key }
        }
        case 'sticky_key': {
            const k = decodeKey(params[0] ?? 0)
            return k ? { type: 'sticky_key', key: k.key } : null
        }
        case 'mod_tap': {
            const tap = decodeKey(params[0] ?? 0)
            const mod = MODIFIERS[params[1] ?? -1]
            if (!tap || !mod) return null
            return {
                type: 'tap_hold',
                tap: tap.mods.length
                    ? { type: 'key_press', key: tap.key, mods: tap.mods }
                    : { type: 'key_press', key: tap.key },
                hold: { type: 'modifier', modifier: mod },
                _preset: 'mod_tap',
            }
        }
        case 'layer_tap': {
            const tap = decodeKey(params[0] ?? 0)
            const layer = ctx.layerNames[params[1] ?? -1]
            if (!tap || layer === undefined) return null
            return {
                type: 'tap_hold',
                tap: tap.mods.length
                    ? { type: 'key_press', key: tap.key, mods: tap.mods }
                    : { type: 'key_press', key: tap.key },
                hold: { type: 'layer', layer },
                _preset: 'layer_tap',
            }
        }
        case 'layer_momentary':
        case 'layer_toggle':
        case 'layer_to':
        case 'layer_sticky': {
            const layer = ctx.layerNames[params[0] ?? -1]
            return layer === undefined
                ? null
                : { type: 'layer', mode: LAYER_MODE[kind], layer }
        }
        case 'macro': {
            const ref = ctx.macroIds[params[0] ?? -1]
            return ref ? { type: 'macro', ref } : null
        }
        case 'tap_dance': {
            const ref = ctx.tapDanceIds[params[0] ?? -1]
            return ref ? { type: 'tap_dance', ref } : null
        }
        case 'output':
        case 'ext_power':
        case 'lighting':
        case 'mouse': {
            const def = ENUM_ACTIONS[kind as EnumKind].find(
                (d) => d.value === (params[0] ?? -1),
            )
            return def ? def.action : null
        }
        default:
            return NULLARY.has(kind as CanonAction['type'])
                ? ({ type: kind } as CanonAction)
                : null
    }
}
