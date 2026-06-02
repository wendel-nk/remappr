// Pattern check: no GoF pattern (-) — rejected — surface→canonical transformation functions; pure data mapping, no abstraction.
//
// Lowers a validated SURFACE doc into the single canonical form. Every
// shorthand is expanded: bare/combo strings → key_press, mod_tap/layer_tap →
// tap_hold, leaving the compiler one shape per behavior. Original spellings are
// stashed on `_keySrc`/`_preset` so serialize can round-trip the user's style.

import { parseKeyToken, resolveKeycode } from './keycodes'
import { parseSurface, type SurfaceAction, type SurfaceKeymap } from './schema'
import type {
    CanonAction,
    CanonEncoderBinding,
    CanonHoldTarget,
    CanonKeyPress,
    CanonMacroStep,
    ConfigKeymap,
} from './types'

// Validated upstream, so resolveKeycode never returns null here; `??` keeps TS
// honest and degrades to the raw token rather than throwing.
const toCanonical = (token: string): string => resolveKeycode(token) ?? token

type TapTarget = Extract<SurfaceAction, { type: 'key_press' }> | string

function normalizeTapTarget(tap: TapTarget): CanonKeyPress {
    if (typeof tap === 'string') {
        const parsed = parseKeyToken(tap)
        return {
            type: 'key_press',
            key: parsed ? parsed.key : toCanonical(tap),
            ...(parsed && parsed.mods.length ? { mods: parsed.mods } : {}),
            _keySrc: tap,
        }
    }
    return {
        type: 'key_press',
        key: toCanonical(tap.key),
        ...(tap.mods?.length ? { mods: tap.mods } : {}),
        _keySrc: tap.key,
    }
}

const timings = (a: {
    tappingTermMs?: number
    quickTapMs?: number
    resolve?: 'timeout' | 'prefer-hold' | 'prefer-tap'
}): Pick<
    Extract<CanonAction, { type: 'tap_hold' }>,
    'tappingTermMs' | 'quickTapMs' | 'resolve'
> => ({
    ...(a.tappingTermMs !== undefined
        ? { tappingTermMs: a.tappingTermMs }
        : {}),
    ...(a.quickTapMs !== undefined ? { quickTapMs: a.quickTapMs } : {}),
    ...(a.resolve !== undefined ? { resolve: a.resolve } : {}),
})

export function normalizeAction(b: SurfaceAction): CanonAction {
    if (typeof b === 'string') {
        const parsed = parseKeyToken(b)
        return {
            type: 'key_press',
            key: parsed ? parsed.key : toCanonical(b),
            ...(parsed && parsed.mods.length ? { mods: parsed.mods } : {}),
            _keySrc: b,
        }
    }

    switch (b.type) {
        case 'key_press':
            return {
                type: 'key_press',
                key: toCanonical(b.key),
                ...(b.mods?.length ? { mods: b.mods } : {}),
                _keySrc: b.key,
            }
        case 'tap_hold':
            return {
                type: 'tap_hold',
                tap: normalizeTapTarget(b.tap),
                hold: b.hold as CanonHoldTarget,
                ...timings(b),
            }
        case 'mod_tap':
            return {
                type: 'tap_hold',
                tap: normalizeTapTarget(b.tap),
                hold: { type: 'modifier', modifier: b.mod },
                ...timings(b),
                _preset: 'mod_tap',
            }
        case 'layer_tap':
            return {
                type: 'tap_hold',
                tap: normalizeTapTarget(b.tap),
                hold: { type: 'layer', layer: b.layer },
                ...timings(b),
                _preset: 'layer_tap',
            }
        case 'layer':
            return { type: 'layer', mode: b.mode, layer: b.layer }
        case 'sticky_key':
            return {
                type: 'sticky_key',
                key: toCanonical(b.key),
                _keySrc: b.key,
            }
        case 'output':
            return {
                type: 'output',
                action: b.action,
                ...(b.profile !== undefined ? { profile: b.profile } : {}),
            }
        case 'lighting':
            return { type: 'lighting', target: b.target, action: b.action }
        case 'macro':
            return {
                type: 'macro',
                ref: b.ref,
                ...(b.param !== undefined
                    ? { param: toCanonical(b.param), _paramSrc: b.param }
                    : {}),
            }
        case 'tap_dance':
            return { type: 'tap_dance', ref: b.ref }
        case 'key_toggle':
            return {
                type: 'key_toggle',
                key: toCanonical(b.key),
                _keySrc: b.key,
            }
        case 'ext_power':
            return { type: 'ext_power', action: b.action }
        case 'mouse_key':
            return { type: 'mouse_key', button: b.button }
        case 'mouse_move':
            return { type: 'mouse_move', direction: b.direction }
        case 'mouse_scroll':
            return { type: 'mouse_scroll', direction: b.direction }
        default:
            // caps_word | transparent | none | bootloader | reset |
            // soft_off | studio_unlock | grave_escape | key_repeat
            return { type: b.type }
    }
}

function normalizeEncoder(
    e: NonNullable<SurfaceKeymap['layers'][number]['encoders']>[number],
): CanonEncoderBinding {
    return {
        cw: normalizeAction(e.cw),
        ccw: normalizeAction(e.ccw),
        ...(e.press ? { press: normalizeAction(e.press) } : {}),
    }
}

function normalizeMacroStep(
    s: NonNullable<SurfaceKeymap['macros']>[number]['steps'][number],
): CanonMacroStep {
    if (s.type === 'wait') return { type: 'wait', ms: s.ms }
    if (s.type === 'text') return { type: 'text', text: s.text }
    if (s.type === 'param') return { type: 'param' }
    if (s.type === 'pause_for_release') return { type: 'pause_for_release' }
    return { type: s.type, key: toCanonical(s.key), _keySrc: s.key }
}

export function normalizeKeymap(km: SurfaceKeymap): ConfigKeymap {
    return {
        schemaVersion: 1,
        kind: 'remappr.keymap',
        meta: { ...km.meta, target: km.meta.target ?? null },
        ...(km.defaults ? { defaults: km.defaults } : {}),
        keyboard: {
            id: km.keyboard.id,
            name: km.keyboard.name,
            keys: km.keyboard.keys.map((k) => ({ ...k })),
            ...(km.keyboard.encoders
                ? { encoders: km.keyboard.encoders.map((e) => ({ ...e })) }
                : {}),
        },
        layers: km.layers.map((l) => ({
            name: l.name,
            ...(l.description ? { description: l.description } : {}),
            bindings: l.bindings.map(normalizeAction),
            ...(l.encoders
                ? { encoders: l.encoders.map(normalizeEncoder) }
                : {}),
        })),
        ...(km.combos
            ? {
                  combos: km.combos.map((c) => ({
                      name: c.name,
                      keys: [...c.keys],
                      action: normalizeAction(c.action),
                      ...(c.timeoutMs !== undefined
                          ? { timeoutMs: c.timeoutMs }
                          : {}),
                      ...(c.layers ? { layers: [...c.layers] } : {}),
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
                          action: normalizeAction(tap.action),
                      })),
                      ...(t.hold ? { hold: t.hold as CanonHoldTarget } : {}),
                  })),
              }
            : {}),
        ...(km.macros
            ? {
                  macros: km.macros.map((m) => ({
                      id: m.id,
                      ...(m.description ? { description: m.description } : {}),
                      ...(m.params !== undefined ? { params: m.params } : {}),
                      steps: m.steps.map(normalizeMacroStep),
                  })),
              }
            : {}),
    }
}

/** Parse + validate + normalize JSON source into the canonical ConfigKeymap. Throws on invalid. */
export function parseKeymap(source: string): ConfigKeymap {
    return normalizeKeymap(parseSurface(source))
}
