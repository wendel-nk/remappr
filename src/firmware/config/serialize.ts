// Pattern check: no GoF pattern (-) — rejected — canonical→surface denormalization + JSON emit; pure transformation, no abstraction.
//
// Re-saves a canonical ConfigKeymap as friendly JSON. Defaults to the compact,
// reads-like-English surface form (bare-string keys, "Ctrl+C" combos, presets,
// friendly keycode names). Per-binding override: if the user originally wrote a
// canonical id (or any alias) it is preserved via `_keySrc`. Top-level + object
// key order is fixed so re-saves are stable diffs.

import { friendlyName, resolveKeycode, type Modifier } from './keycodes'
import { cloneHardware, cloneLighting } from './normalize'
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
    ...(a.flavor !== undefined ? { flavor: a.flavor } : {}),
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
            return {
                type: 'lighting',
                target: a.target,
                action: a.action,
                ...(a.hue !== undefined ? { hue: a.hue } : {}),
                ...(a.saturation !== undefined
                    ? { saturation: a.saturation }
                    : {}),
                ...(a.brightness !== undefined
                    ? { brightness: a.brightness }
                    : {}),
                ...(a.level !== undefined ? { level: a.level } : {}),
            }
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
        case 'mod_morph':
            return { type: 'mod_morph', ref: a.ref }
        case 'hold_tap':
            return {
                type: 'hold_tap',
                ref: a.ref,
                holdParam: a.holdParam,
                tapParam: a.tapParam,
            }
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
    if (s.type === 'tap_time') return { type: 'tap_time', ms: s.ms }
    if (s.type === 'param')
        return {
            type: 'param',
            ...(s.from !== undefined ? { from: s.from } : {}),
            ...(s.to !== undefined ? { to: s.to } : {}),
        }
    if (s.type === 'pause_for_release') return { type: s.type }
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
            ...(km.meta.vendorId ? { vendorId: km.meta.vendorId } : {}),
            ...(km.meta.productId ? { productId: km.meta.productId } : {}),
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
                ...(k.variant ? { variant: k.variant } : {}),
                ...(k.pin ? { pin: k.pin } : {}),
                ...(k.element ? { element: k.element } : {}),
            })),
            ...(km.keyboard.encoders
                ? {
                      encoders: km.keyboard.encoders.map((e) => ({
                          x: e.x,
                          y: e.y,
                      })),
                  }
                : {}),
            // hardware is already canonical (no surface sugar) — emit it as-is
            // with stable key order via the same clone normalize uses.
            ...(km.keyboard.hardware
                ? { hardware: cloneHardware(km.keyboard.hardware) }
                : {}),
            ...(km.keyboard.pins
                ? {
                      pins: {
                          rows: [...km.keyboard.pins.rows],
                          cols: [...km.keyboard.pins.cols],
                      },
                  }
                : {}),
            ...(km.keyboard.firmware
                ? { firmware: [...km.keyboard.firmware] }
                : {}),
            ...(km.keyboard.lighting
                ? { lighting: cloneLighting(km.keyboard.lighting) }
                : {}),
            ...(km.keyboard.layouts
                ? { layouts: km.keyboard.layouts.map((l) => ({ ...l })) }
                : {}),
            ...(km.keyboard.split !== undefined
                ? { split: km.keyboard.split }
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
        ...(km.modMorphs
            ? {
                  modMorphs: km.modMorphs.map((mm) => ({
                      id: mm.id,
                      ...(mm.description
                          ? { description: mm.description }
                          : {}),
                      mods: [...mm.mods],
                      ...(mm.keepMods ? { keepMods: [...mm.keepMods] } : {}),
                      bindings: [
                          denormalizeAction(mm.bindings[0]),
                          denormalizeAction(mm.bindings[1]),
                      ],
                  })),
              }
            : {}),
        // pattern-check: skip — holdTaps passthrough, mirror of normalize.ts
        ...(km.holdTaps
            ? {
                  holdTaps: km.holdTaps.map((h) => ({
                      id: h.id,
                      ...(h.description ? { description: h.description } : {}),
                      ...(h.flavor ? { flavor: h.flavor } : {}),
                      ...(h.tappingTermMs !== undefined
                          ? { tappingTermMs: h.tappingTermMs }
                          : {}),
                      ...(h.quickTapMs !== undefined
                          ? { quickTapMs: h.quickTapMs }
                          : {}),
                      ...(h.requirePriorIdleMs !== undefined
                          ? { requirePriorIdleMs: h.requirePriorIdleMs }
                          : {}),
                      ...(h.holdTriggerKeyPositions
                          ? {
                                holdTriggerKeyPositions:
                                    h.holdTriggerKeyPositions,
                            }
                          : {}),
                      ...(h.holdTriggerOnRelease !== undefined
                          ? { holdTriggerOnRelease: h.holdTriggerOnRelease }
                          : {}),
                      ...(h.retroTap !== undefined
                          ? { retroTap: h.retroTap }
                          : {}),
                      bindings: [h.bindings[0], h.bindings[1]],
                  })),
              }
            : {}),
        ...(km.conditionalLayers
            ? {
                  conditionalLayers: km.conditionalLayers.map((cl) => ({
                      ifLayers: [...cl.ifLayers],
                      thenLayer: cl.thenLayer,
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
