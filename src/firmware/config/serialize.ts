// Pattern check: no GoF pattern (-) — rejected — canonical→surface denormalization + JSON emit; pure transformation, no abstraction.
//
// Re-saves a canonical ConfigKeymap as friendly JSON. Defaults to the compact,
// reads-like-English surface form (bare-string keys, "Ctrl+C" combos, presets,
// friendly keycode names). Per-binding override: if the user originally wrote a
// canonical id (or any alias) it is preserved via `_keySrc`. Top-level + object
// key order is fixed so re-saves are stable diffs.

import { friendlyName, resolveKeycode, type Modifier } from './keycodes'
import type {
    CanonAction,
    CanonEncoderBinding,
    CanonHoldTarget,
    CanonKeyPress,
    CanonMacroStep,
    ConfigKeymap,
} from './types'

const FRIENDLY_MOD: Record<Modifier, string> = {
    LEFT_CTRL: 'Ctrl',
    LEFT_SHIFT: 'Shift',
    LEFT_ALT: 'Alt',
    LEFT_GUI: 'Gui',
    RIGHT_CTRL: 'RCtrl',
    RIGHT_SHIFT: 'RShift',
    RIGHT_ALT: 'RAlt',
    RIGHT_GUI: 'RGui',
}

// Preserve the user's spelling when it still resolves to the same key; else friendly.
const keyToken = (id: string, src?: string): string =>
    src && resolveKeycode(src) === id ? src : friendlyName(id)

type Surface = string | Record<string, unknown>

function denormalizeKeyPress(kp: CanonKeyPress): Surface {
    const token = keyToken(kp.key, kp._keySrc)
    if (kp.mods?.length) {
        return [...kp.mods.map((m) => FRIENDLY_MOD[m]), token].join('+')
    }
    return token
}

const denormalizeHold = (h: CanonHoldTarget): Record<string, unknown> =>
    h.type === 'modifier'
        ? { type: 'modifier', modifier: h.modifier }
        : { type: 'layer', layer: h.layer }

const withTimings = (
    a: Extract<CanonAction, { type: 'tap_hold' }>,
): Record<string, unknown> => ({
    ...(a.tappingTermMs !== undefined
        ? { tappingTermMs: a.tappingTermMs }
        : {}),
    ...(a.quickTapMs !== undefined ? { quickTapMs: a.quickTapMs } : {}),
    ...(a.resolve !== undefined ? { resolve: a.resolve } : {}),
})

export function denormalizeAction(a: CanonAction): Surface {
    switch (a.type) {
        case 'key_press':
            return denormalizeKeyPress(a)
        case 'tap_hold': {
            // Honor the form the user wrote: preset if they used one, else raw tap_hold.
            if (a._preset === 'mod_tap' && a.hold.type === 'modifier') {
                return {
                    type: 'mod_tap',
                    tap: denormalizeKeyPress(a.tap),
                    mod: a.hold.modifier,
                    ...withTimings(a),
                }
            }
            if (a._preset === 'layer_tap' && a.hold.type === 'layer') {
                return {
                    type: 'layer_tap',
                    tap: denormalizeKeyPress(a.tap),
                    layer: a.hold.layer,
                    ...withTimings(a),
                }
            }
            return {
                type: 'tap_hold',
                tap: denormalizeKeyPress(a.tap),
                hold: denormalizeHold(a.hold),
                ...withTimings(a),
            }
        }
        case 'layer':
            return { type: 'layer', mode: a.mode, layer: a.layer }
        case 'sticky_key':
            return { type: 'sticky_key', key: keyToken(a.key, a._keySrc) }
        case 'output':
            return {
                type: 'output',
                action: a.action,
                ...(a.profile !== undefined ? { profile: a.profile } : {}),
            }
        case 'lighting':
            return { type: 'lighting', target: a.target, action: a.action }
        case 'macro':
            return {
                type: 'macro',
                ref: a.ref,
                ...(a.param !== undefined
                    ? { param: keyToken(a.param, a._paramSrc) }
                    : {}),
            }
        case 'tap_dance':
            return { type: 'tap_dance', ref: a.ref }
        case 'key_toggle':
            return { type: 'key_toggle', key: keyToken(a.key, a._keySrc) }
        case 'ext_power':
            return { type: 'ext_power', action: a.action }
        case 'mouse_key':
            return { type: 'mouse_key', button: a.button }
        case 'mouse_move':
            return { type: 'mouse_move', direction: a.direction }
        case 'mouse_scroll':
            return { type: 'mouse_scroll', direction: a.direction }
        default:
            // soft_off | studio_unlock | grave_escape | key_repeat |
            // caps_word | transparent | none | bootloader | reset
            return { type: a.type }
    }
}

const denormalizeEncoder = (
    e: CanonEncoderBinding,
): Record<string, unknown> => ({
    cw: denormalizeAction(e.cw),
    ccw: denormalizeAction(e.ccw),
    ...(e.press ? { press: denormalizeAction(e.press) } : {}),
})

const denormalizeMacroStep = (s: CanonMacroStep): Record<string, unknown> => {
    if (s.type === 'wait') return { type: 'wait', ms: s.ms }
    if (s.type === 'text') return { type: 'text', text: s.text }
    if (s.type === 'param' || s.type === 'pause_for_release')
        return { type: s.type }
    return { type: s.type, key: keyToken(s.key, s._keySrc) }
}

/** Build the plain (surface-shaped) object that gets JSON-stringified. */
export function toSurfaceObject(km: ConfigKeymap): Record<string, unknown> {
    return {
        schemaVersion: km.schemaVersion,
        kind: km.kind,
        meta: {
            name: km.meta.name,
            ...(km.meta.author ? { author: km.meta.author } : {}),
            ...(km.meta.version ? { version: km.meta.version } : {}),
            ...(km.meta.description
                ? { description: km.meta.description }
                : {}),
            target: km.meta.target,
        },
        ...(km.defaults ? { defaults: km.defaults } : {}),
        keyboard: {
            id: km.keyboard.id,
            name: km.keyboard.name,
            keys: km.keyboard.keys.map((k) => ({
                x: k.x,
                y: k.y,
                ...(k.w !== 1 ? { w: k.w } : {}),
                ...(k.h !== 1 ? { h: k.h } : {}),
                ...(k.r !== 0 ? { r: k.r } : {}),
                ...(k.rx !== undefined ? { rx: k.rx } : {}),
                ...(k.ry !== undefined ? { ry: k.ry } : {}),
            })),
            ...(km.keyboard.encoders
                ? {
                      encoders: km.keyboard.encoders.map((e) => ({
                          x: e.x,
                          y: e.y,
                      })),
                  }
                : {}),
        },
        layers: km.layers.map((l) => ({
            name: l.name,
            ...(l.description ? { description: l.description } : {}),
            bindings: l.bindings.map(denormalizeAction),
            ...(l.encoders
                ? { encoders: l.encoders.map(denormalizeEncoder) }
                : {}),
        })),
        ...(km.combos
            ? {
                  combos: km.combos.map((c) => ({
                      name: c.name,
                      keys: c.keys,
                      action: denormalizeAction(c.action),
                      ...(c.timeoutMs !== undefined
                          ? { timeoutMs: c.timeoutMs }
                          : {}),
                      ...(c.layers ? { layers: c.layers } : {}),
                  })),
              }
            : {}),
        ...(km.tapDances
            ? {
                  tapDances: km.tapDances.map((t) => ({
                      id: t.id,
                      ...(t.description ? { description: t.description } : {}),
                      ...(t.tappingTermMs !== undefined
                          ? { tappingTermMs: t.tappingTermMs }
                          : {}),
                      taps: t.taps.map((tap) => ({
                          count: tap.count,
                          action: denormalizeAction(tap.action),
                      })),
                      ...(t.hold ? { hold: denormalizeHold(t.hold) } : {}),
                  })),
              }
            : {}),
        ...(km.macros
            ? {
                  macros: km.macros.map((m) => ({
                      id: m.id,
                      ...(m.description ? { description: m.description } : {}),
                      ...(m.params !== undefined ? { params: m.params } : {}),
                      steps: m.steps.map(denormalizeMacroStep),
                  })),
              }
            : {}),
    }
}

// pattern-check: skip — lib swap JSON5.stringify → built-in JSON.stringify
/** Serialize a canonical ConfigKeymap to friendly JSON (2-space indent). The
 *  surface sugar (bare-string keys, "Ctrl+C" combos, presets) is preserved in
 *  the object shape; only JSON5's cosmetic syntax (comments, unquoted keys) is
 *  gone — app-visible notes live in `description` fields instead. */
export function serializeKeymap(km: ConfigKeymap): string {
    return JSON.stringify(toSurfaceObject(km), null, 2)
}
