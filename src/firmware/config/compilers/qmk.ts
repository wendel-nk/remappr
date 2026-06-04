// Pattern check: Strategy (Tier 1) — extended — concrete QMK KeymapCompiler registered into the Strategy registry; Keychron reuses this emitter (it runs the VIA/QMK stack).
//
// Emits a QMK keymap.c `keymaps[][MATRIX_ROWS][MATRIX_COLS]` table directly from
// the canonical config. Combos / macros / tap-dance need extra C scaffolding
// (process_record_user, tap_dance_actions, …) which v1 does not generate — those
// emit a `warn` and a KC_NO placeholder so the table still compiles cleanly.

import type { ExportedFile } from '../../types'
import { supportsLighting, supportsOutput } from '../capabilities'
import { runCompile, registerCompiler, type KeymapCompiler } from '../compiler'
import type { DiagnosticBag } from '../diagnostics'
import { QMK_MODTAP, QMK_MOD_FN, qmkKeyName } from '../names'
import type {
    CanonAction,
    CanonKeyPress,
    ConfigKeymap,
    LightingAction,
    Target,
} from '../types'

const RGB: Partial<Record<LightingAction, string>> = {
    toggle: 'RGB_TOG',
    brightness_up: 'RGB_VAI',
    brightness_down: 'RGB_VAD',
    hue_up: 'RGB_HUI',
    hue_down: 'RGB_HUD',
    saturation_up: 'RGB_SAI',
    saturation_down: 'RGB_SAD',
    effect_next: 'RGB_MOD',
    effect_previous: 'RGB_RMOD',
    speed_up: 'RGB_SPI',
    speed_down: 'RGB_SPD',
}
const BL: Partial<Record<LightingAction, string>> = {
    toggle: 'BL_TOGG',
    on: 'BL_ON',
    off: 'BL_OFF',
    brightness_up: 'BL_UP',
    brightness_down: 'BL_DOWN',
}

// pattern-check: skip — static keycode lookup tables for the QMK compiler
const MOUSE_BTN: Record<string, string> = {
    left: 'KC_MS_BTN1',
    right: 'KC_MS_BTN2',
    middle: 'KC_MS_BTN3',
    mb4: 'KC_MS_BTN4',
    mb5: 'KC_MS_BTN5',
}
const MOVE: Record<string, string> = {
    up: 'KC_MS_UP',
    down: 'KC_MS_DOWN',
    left: 'KC_MS_LEFT',
    right: 'KC_MS_RIGHT',
}
const SCRL: Record<string, string> = {
    up: 'KC_MS_WH_UP',
    down: 'KC_MS_WH_DOWN',
    left: 'KC_MS_WH_LEFT',
    right: 'KC_MS_WH_RIGHT',
}

interface Ctx {
    target: Target
    layerIndex: Map<string, number>
    diag: DiagnosticBag
}

function kp(a: CanonKeyPress): string {
    let token = qmkKeyName(a.key)
    for (const m of a.mods ?? []) token = `${QMK_MOD_FN[m]}(${token})`
    return token
}

function emitKeycode(
    a: CanonAction,
    ctx: Ctx,
    path: (string | number)[],
): string {
    const layerIdx = (name: string): number => ctx.layerIndex.get(name) ?? 0
    switch (a.type) {
        case 'key_press':
            return kp(a)
        case 'tap_hold':
            return a.hold.type === 'modifier'
                ? `${QMK_MODTAP[a.hold.modifier]}(${qmkKeyName(a.tap.key)})`
                : `LT(${layerIdx(a.hold.layer)}, ${qmkKeyName(a.tap.key)})`
        case 'layer':
            return a.mode === 'momentary'
                ? `MO(${layerIdx(a.layer)})`
                : a.mode === 'toggle'
                  ? `TG(${layerIdx(a.layer)})`
                  : a.mode === 'to'
                    ? `TO(${layerIdx(a.layer)})`
                    : `OSL(${layerIdx(a.layer)})`
        case 'sticky_key':
            ctx.diag.warn(
                'QMK one-shot applies to modifiers only; emitted the bare key',
                path,
            )
            return qmkKeyName(a.key)
        case 'caps_word':
            return 'CW_TOGG'
        case 'transparent':
            return 'KC_TRNS'
        case 'none':
            return 'KC_NO'
        case 'bootloader':
            return 'QK_BOOT'
        case 'reset':
            return 'QK_RBT'
        case 'output':
            if (!supportsOutput(ctx.target, a.action)) {
                ctx.diag.warn(
                    `output "${a.action}" has no standard ${ctx.target} keycode; emitted KC_NO`,
                    path,
                )
                return 'KC_NO'
            }
            return 'KC_NO' // usb is the implicit default on QMK; no dedicated keycode
        case 'lighting': {
            if (!supportsLighting(ctx.target, a.target)) {
                ctx.diag.warn(
                    `${a.target} lighting is unavailable on ${ctx.target}; emitted KC_NO`,
                    path,
                )
                return 'KC_NO'
            }
            if (a.target === 'backlight') {
                const t = BL[a.action]
                if (!t) {
                    ctx.diag.warn(
                        `backlight has no "${a.action}" action on ${ctx.target}; emitted KC_NO`,
                        path,
                    )
                    return 'KC_NO'
                }
                return t
            }
            const t = RGB[a.action]
            if (!t) {
                ctx.diag.warn(
                    `RGB has no "${a.action}" action on ${ctx.target}; emitted RGB_TOG`,
                    path,
                )
                return 'RGB_TOG'
            }
            return t
        }
        case 'macro':
            ctx.diag.warn(
                `macro "${a.ref}" requires hand-written C (process_record_user); emitted KC_NO`,
                path,
            )
            return 'KC_NO'
        case 'tap_dance':
            ctx.diag.warn(
                `tap-dance "${a.ref}" requires tap_dance_actions[]; emitted KC_NO`,
                path,
            )
            return 'KC_NO'
        case 'mod_morph':
            ctx.diag.warn(
                `mod-morph "${a.ref}" requires a custom QMK macro / Key Override; emitted KC_NO`,
                path,
            )
            return 'KC_NO'
        case 'hold_tap':
            ctx.diag.warn(
                `custom hold-tap "${a.ref}" has no direct QMK keycode; use MT()/LT() or a tap-hold config; emitted KC_NO`,
                path,
            )
            return 'KC_NO'
        case 'key_repeat':
            return 'QK_REP'
        case 'grave_escape':
            return 'QK_GESC'
        case 'mouse_key':
            return MOUSE_BTN[a.button]
        case 'mouse_move':
            return MOVE[a.direction]
        case 'mouse_scroll':
            return SCRL[a.direction]
        case 'key_toggle':
            ctx.diag.warn(
                'key-toggle has no standard QMK keycode; emitted the bare key',
                path,
            )
            return qmkKeyName(a.key)
        case 'soft_off':
        case 'studio_unlock':
        case 'ext_power':
            ctx.diag.warn(
                `"${a.type}" is ZMK-specific; no QMK keycode; emitted KC_NO`,
                path,
            )
            return 'KC_NO'
    }
}

// pattern-check: skip additive pure QMK encoder_map C-block emitter, no abstraction
// QMK encoder_map[][NUM_ENCODERS][2]: one ENCODER_CCW_CW(ccw, cw) per encoder per
// layer. Sources the per-key element model (encoderBindings, keyed by element:
// 'encoder' key index) first, else the slot array (encoders[]). Press is a matrix
// key in QMK, so it is not part of the map. Returns [] when there are no encoders.
function emitEncoderMap(config: ConfigKeymap, ctx: Ctx): string[] {
    const encoderKeys = config.keyboard.keys
        .map((k, i) => (k.element === 'encoder' ? i : -1))
        .filter((i) => i >= 0)
    const usePerKey = encoderKeys.length > 0
    const count = usePerKey
        ? encoderKeys.length
        : (config.keyboard.encoders?.length ?? 0)
    if (!count) return []

    const trans = 'KC_TRNS'
    const out: string[] = [
        `#ifdef ENCODER_MAP_ENABLE`,
        `const uint16_t PROGMEM encoder_map[][NUM_ENCODERS][2] = {`,
    ]
    config.layers.forEach((layer, li) => {
        const cells: string[] = []
        for (let e = 0; e < count; e++) {
            const binding = usePerKey
                ? layer.encoderBindings?.[encoderKeys[e]]
                : layer.encoders?.[e]
            const path = usePerKey
                ? ['layers', li, 'encoderBindings', encoderKeys[e]]
                : ['layers', li, 'encoders', e]
            const cw = binding
                ? emitKeycode(binding.cw, ctx, [...path, 'cw'])
                : trans
            const ccw = binding
                ? emitKeycode(binding.ccw, ctx, [...path, 'ccw'])
                : trans
            cells.push(`ENCODER_CCW_CW(${ccw}, ${cw})`)
        }
        out.push(`    [${li}] = { ${cells.join(', ')} }, // ${layer.name}`)
    })
    out.push(`};`, `#endif`, ``)
    return out
}

function emit(target: Target, label: string) {
    return (config: ConfigKeymap, diag: DiagnosticBag): ExportedFile[] => {
        const ctx: Ctx = {
            target,
            layerIndex: new Map(config.layers.map((l, i) => [l.name, i])),
            diag,
        }
        if (config.combos?.length)
            diag.warn(
                'combos are not yet generated for QMK; add them in rules.mk/keymap.c',
                ['combos'],
            )
        if (config.conditionalLayers?.length)
            diag.warn(
                'conditional layers are not generated for QMK; use Tri-Layer (tri_layer_*) or layer_state_set_user in keymap.c',
                ['conditionalLayers'],
            )
        const hasEncoders =
            config.layers.some((l) => l.encoders?.length) ||
            config.keyboard.keys.some((k) => k.element === 'encoder')
        if (hasEncoders)
            diag.warn(
                'encoder_map[] is generated below; enable it with ENCODER_MAP_ENABLE = yes in rules.mk (encoder press stays a normal matrix key)',
                ['layers'],
            )

        const lines: string[] = []
        lines.push(`// Generated by remappr — ${label} keymap.c`)
        lines.push(
            `// Device: ${config.keyboard.name}  ·  Layers: ${config.layers.length}`,
        )
        lines.push(``)
        lines.push(`#include QMK_KEYBOARD_H`)
        lines.push(``)
        lines.push(
            `const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {`,
        )
        config.layers.forEach((layer, li) => {
            const cells = layer.bindings.map((b, bi) =>
                emitKeycode(b, ctx, ['layers', li, 'bindings', bi]),
            )
            const wrapped: string[] = []
            for (let i = 0; i < cells.length; i += 8) {
                wrapped.push('        ' + cells.slice(i, i + 8).join(', '))
            }
            lines.push(`    [${li}] = LAYOUT( // ${layer.name}`)
            lines.push(wrapped.join(',\n'))
            lines.push(`    ),`)
        })
        lines.push(`};`)
        lines.push(``)
        lines.push(...emitEncoderMap(config, ctx))
        return [
            {
                filename: 'keymap.c',
                mime: 'text/x-c',
                content: lines.join('\n'),
            },
        ]
    }
}

export const qmkCompiler: KeymapCompiler = {
    target: 'qmk',
    compile: (config) => runCompile(config, emit('qmk', 'QMK')),
}

export const keychronCompiler: KeymapCompiler = {
    target: 'keychron',
    compile: (config) =>
        runCompile(config, emit('keychron', 'Keychron (QMK/VIA)')),
}

registerCompiler(qmkCompiler)
registerCompiler(keychronCompiler)
