// Pattern check: Strategy (Tier 1) — extended — concrete ZMK KeymapCompiler registered into the Strategy registry in compiler.ts.
//
// Emits a ZMK .keymap devicetree overlay directly from the canonical config.
// Behavior coverage tracks https://zmk.dev/docs/keymaps/behaviors. Anything a
// ZMK board can't express (per_key lighting, macro `text` steps, tap-dance
// `hold`) emits a `warn` diagnostic and degrades to a safe binding rather than
// producing broken devicetree.

import type { ExportedFile } from '../../types'
import type { DiagnosticBag } from '../diagnostics'
import { runCompile, registerCompiler, type KeymapCompiler } from '../compiler'
import { ZMK_MOD, ZMK_MOD_FN, zmkKeyName } from '../names'
import type {
    CanonAction,
    CanonKeyPress,
    CanonMacro,
    CanonTapDance,
    ConfigKeymap,
    LightingAction,
} from '../types'

const RGB_UG: Partial<Record<LightingAction, string>> = {
    toggle: 'RGB_TOG',
    on: 'RGB_ON',
    off: 'RGB_OFF',
    brightness_up: 'RGB_BRI',
    brightness_down: 'RGB_BRD',
    hue_up: 'RGB_HUI',
    hue_down: 'RGB_HUD',
    saturation_up: 'RGB_SAI',
    saturation_down: 'RGB_SAD',
    effect_next: 'RGB_EFF',
    effect_previous: 'RGB_EFR',
    speed_up: 'RGB_SPI',
    speed_down: 'RGB_SPD',
}
const BL: Partial<Record<LightingAction, string>> = {
    toggle: 'BL_TOG',
    on: 'BL_ON',
    off: 'BL_OFF',
    brightness_up: 'BL_INC',
    brightness_down: 'BL_DEC',
}

const EP: Record<'toggle' | 'on' | 'off', string> = {
    toggle: 'EP_TOG',
    on: 'EP_ON',
    off: 'EP_OFF',
}
const MOUSE_BTN: Record<string, string> = {
    left: 'MB1',
    right: 'MB2',
    middle: 'MB3',
    mb4: 'MB4',
    mb5: 'MB5',
}
const MOVE: Record<string, string> = {
    up: 'MOVE_UP',
    down: 'MOVE_DOWN',
    left: 'MOVE_LEFT',
    right: 'MOVE_RIGHT',
}
const SCRL: Record<string, string> = {
    up: 'SCRL_UP',
    down: 'SCRL_DOWN',
    left: 'SCRL_LEFT',
    right: 'SCRL_RIGHT',
}

const sanitize = (id: string): string => id.replace(/[^a-zA-Z0-9_]/g, '_')

interface Ctx {
    layerIndex: Map<string, number>
    diag: DiagnosticBag
}

function kp(kpAction: CanonKeyPress): string {
    let token = zmkKeyName(kpAction.key)
    // Wrap modifiers innermost-last: LC(LS(A)).
    for (const m of kpAction.mods ?? []) token = `${ZMK_MOD_FN[m]}(${token})`
    return `&kp ${token}`
}

function emitBinding(
    a: CanonAction,
    ctx: Ctx,
    path: (string | number)[],
): string {
    const layerIdx = (name: string): number => {
        const i = ctx.layerIndex.get(name)
        if (i === undefined) {
            ctx.diag.error(`unknown layer "${name}"`, path)
            return 0
        }
        return i
    }
    switch (a.type) {
        case 'key_press':
            return kp(a)
        case 'tap_hold':
            return a.hold.type === 'modifier'
                ? `&mt ${ZMK_MOD[a.hold.modifier]} ${zmkKeyName(a.tap.key)}`
                : `&lt ${layerIdx(a.hold.layer)} ${zmkKeyName(a.tap.key)}`
        case 'layer':
            return a.mode === 'momentary'
                ? `&mo ${layerIdx(a.layer)}`
                : a.mode === 'toggle'
                  ? `&tog ${layerIdx(a.layer)}`
                  : a.mode === 'to'
                    ? `&to ${layerIdx(a.layer)}`
                    : `&sl ${layerIdx(a.layer)}`
        case 'sticky_key':
            return `&sk ${zmkKeyName(a.key)}`
        case 'caps_word':
            return '&caps_word'
        case 'transparent':
            return '&trans'
        case 'none':
            return '&none'
        case 'bootloader':
            return '&bootloader'
        case 'reset':
            return '&sys_reset'
        case 'output':
            if (a.action === 'usb') return '&out OUT_USB'
            if (a.action === 'toggle') return '&out OUT_TOG'
            if (a.action === 'bluetooth_clear') return '&bt BT_CLR'
            if (a.action === 'bluetooth_next') return '&bt BT_NXT'
            if (a.action === 'bluetooth_prev') return '&bt BT_PRV'
            return a.profile !== undefined
                ? `&bt BT_SEL ${a.profile}`
                : '&out OUT_BLE'
        case 'lighting': {
            if (a.target === 'per_key') {
                ctx.diag.warn(
                    'per_key lighting is not available on ZMK; emitted &none',
                    path,
                )
                return '&none'
            }
            if (a.target === 'backlight') {
                const t = BL[a.action]
                if (!t) {
                    ctx.diag.warn(
                        `backlight has no "${a.action}" action on ZMK; emitted &none`,
                        path,
                    )
                    return '&none'
                }
                return `&bl ${t}`
            }
            return `&rgb_ug ${RGB_UG[a.action] ?? 'RGB_TOG'}`
        }
        case 'macro':
            return a.param !== undefined
                ? `&${sanitize(a.ref)} ${zmkKeyName(a.param)}`
                : `&${sanitize(a.ref)}`
        case 'tap_dance':
            return `&${sanitize(a.ref)}`
        case 'soft_off':
            return '&soft_off'
        case 'studio_unlock':
            return '&studio_unlock'
        case 'grave_escape':
            return '&gresc'
        case 'key_repeat':
            return '&key_repeat'
        case 'key_toggle':
            return `&kt ${zmkKeyName(a.key)}`
        case 'ext_power':
            return `&ext_power ${EP[a.action]}`
        case 'mouse_key':
            return `&mkp ${MOUSE_BTN[a.button]}`
        case 'mouse_move':
            return `&mmv ${MOVE[a.direction]}`
        case 'mouse_scroll':
            return `&msc ${SCRL[a.direction]}`
    }
}

function emitMacros(macros: CanonMacro[], ctx: Ctx): string[] {
    const out: string[] = []
    out.push('    macros {')
    for (const m of macros) {
        const bindings: string[] = []
        for (const s of m.steps) {
            if (s.type === 'press')
                bindings.push(`<&macro_press &kp ${zmkKeyName(s.key)}>`)
            else if (s.type === 'release')
                bindings.push(`<&macro_release &kp ${zmkKeyName(s.key)}>`)
            else if (s.type === 'tap')
                bindings.push(`<&macro_tap &kp ${zmkKeyName(s.key)}>`)
            else if (s.type === 'wait')
                bindings.push(`<&macro_wait_time ${s.ms}>`)
            else if (s.type === 'param')
                bindings.push(`<&macro_tap &macro_param_1to1>`)
            else if (s.type === 'pause_for_release')
                bindings.push(`<&macro_pause_for_release>`)
            else
                ctx.diag.warn(
                    `macro "${m.id}" text steps are not generated for ZMK`,
                    ['macros'],
                )
        }
        // A one-param macro uses a distinct compatible + #binding-cells = <1>.
        const oneParam =
            m.params === 1 || m.steps.some((s) => s.type === 'param')
        out.push(`        ${sanitize(m.id)}: ${sanitize(m.id)} {`)
        out.push(
            `            compatible = "zmk,behavior-macro${oneParam ? '-one-param' : ''}";`,
        )
        out.push(`            #binding-cells = <${oneParam ? 1 : 0}>;`)
        out.push(`            bindings = ${bindings.join(', ')};`)
        out.push(`        };`)
    }
    out.push('    };')
    return out
}

function emitTapDances(tds: CanonTapDance[], ctx: Ctx): string[] {
    const out: string[] = []
    out.push('    behaviors {')
    for (const td of tds) {
        if (td.hold) {
            ctx.diag.warn(
                `tap-dance "${td.id}" hold action is not representable in a ZMK tap-dance; dropped`,
                ['tapDances'],
            )
        }
        const bindings = [...td.taps]
            .sort((a, b) => a.count - b.count)
            .map((t) => `<${emitBinding(t.action, ctx, ['tapDances'])}>`)
        out.push(`        ${sanitize(td.id)}: ${sanitize(td.id)} {`)
        out.push(`            compatible = "zmk,behavior-tap-dance";`)
        out.push(`            #binding-cells = <0>;`)
        if (td.tappingTermMs !== undefined)
            out.push(`            tapping-term-ms = <${td.tappingTermMs}>;`)
        out.push(`            bindings = ${bindings.join(', ')};`)
        out.push(`        };`)
    }
    out.push('    };')
    return out
}

// Emit the `zmk,physical-layout` node from the config geometry. Hardware nodes
// (kscan / matrix-transform / pinctrl / LED drivers) are board-specific and are
// intentionally NOT generated — they live in the board's own overlay.
function emitOverlay(config: ConfigKeymap): ExportedFile {
    const cu = (n: number): number => Math.round(n * 100) // key units -> centi-units
    const keyLines = config.keyboard.keys.map((k, i) => {
        const attrs =
            `<&key_physical_attrs ${cu(k.w)} ${cu(k.h)} ${cu(k.x)} ${cu(k.y)} ` +
            `${cu(k.r)} ${cu(k.rx ?? 0)} ${cu(k.ry ?? 0)}>`
        return `            ${i === 0 ? '=' : ','} ${attrs}`
    })

    const lines = [
        `/* Generated by remappr — ZMK physical layout for ${config.keyboard.name}.`,
        ` * Only the key geometry is generated. Hardware nodes (kscan,`,
        ` * matrix-transform, pinctrl, backlight/underglow drivers) are board-`,
        ` * specific — keep them in your board/shield overlay. */`,
        `#include <physical_layouts.dtsi>`,
        ``,
        `/ {`,
        `    physical_layout_default: physical_layout_default {`,
        `        compatible = "zmk,physical-layout";`,
        `        display-name = "${config.keyboard.name}";`,
        `        keys`,
        ...keyLines,
        `            ;`,
        `    };`,
        `};`,
        ``,
    ]
    return {
        filename: `${sanitize(config.keyboard.id || config.keyboard.name)}.overlay`,
        mime: 'text/plain',
        content: lines.join('\n'),
    }
}

function emitKeymap(config: ConfigKeymap, diag: DiagnosticBag): ExportedFile[] {
    const ctx: Ctx = {
        layerIndex: new Map(config.layers.map((l, i) => [l.name, i])),
        diag,
    }

    const lines: string[] = []
    lines.push(
        `/* Generated by remappr — ZMK keymap for ${config.keyboard.name} */`,
    )
    lines.push(`#include <behaviors.dtsi>`)
    lines.push(`#include <dt-bindings/zmk/keys.h>`)
    lines.push(`#include <dt-bindings/zmk/bt.h>`)
    lines.push(`#include <dt-bindings/zmk/outputs.h>`)
    lines.push(`#include <dt-bindings/zmk/rgb.h>`)
    lines.push(`#include <dt-bindings/zmk/backlight.h>`)
    lines.push(`#include <dt-bindings/zmk/ext_power.h>`)
    lines.push(`#include <dt-bindings/zmk/pointing.h>`)
    lines.push(``)
    lines.push(`/ {`)

    if (config.macros?.length) lines.push(...emitMacros(config.macros, ctx), ``)
    if (config.tapDances?.length)
        lines.push(...emitTapDances(config.tapDances, ctx), ``)

    // combos
    if (config.combos?.length) {
        lines.push(`    combos {`)
        lines.push(`        compatible = "zmk,combos";`)
        config.combos.forEach((c, ci) => {
            const binding = emitBinding(c.action, ctx, ['combos', ci, 'action'])
            const layersAttr = c.layers?.length
                ? `\n            layers = <${c.layers.map((n) => ctx.layerIndex.get(n) ?? 0).join(' ')}>;`
                : ''
            lines.push(`        combo_${sanitize(c.name)} {`)
            if (c.timeoutMs !== undefined)
                lines.push(`            timeout-ms = <${c.timeoutMs}>;`)
            lines.push(`            key-positions = <${c.keys.join(' ')}>;`)
            lines.push(`            bindings = <${binding}>;${layersAttr}`)
            lines.push(`        };`)
        })
        lines.push(`    };`)
        lines.push(``)
    }

    // keymap
    lines.push(`    keymap {`)
    lines.push(`        compatible = "zmk,keymap";`)
    config.layers.forEach((layer, li) => {
        const cells = layer.bindings.map((b, bi) =>
            emitBinding(b, ctx, ['layers', li, 'bindings', bi]),
        )
        const wrapped: string[] = []
        for (let i = 0; i < cells.length; i += 6) {
            wrapped.push('                ' + cells.slice(i, i + 6).join(' '))
        }
        lines.push(`        layer_${sanitize(layer.name)} {`)
        lines.push(`            display-name = "${layer.name}";`)
        lines.push(`            bindings = <`)
        lines.push(wrapped.join('\n'))
        lines.push(`            >;`)
        // encoders -> sensor-bindings (only when both directions are plain keypresses)
        if (layer.encoders?.length) {
            const sensors: string[] = []
            let ok = true
            for (const e of layer.encoders) {
                if (e.cw.type === 'key_press' && e.ccw.type === 'key_press') {
                    sensors.push(
                        `&inc_dec_kp ${zmkKeyName(e.cw.key)} ${zmkKeyName(e.ccw.key)}`,
                    )
                } else {
                    ok = false
                }
            }
            if (ok && sensors.length) {
                lines.push(
                    `            sensor-bindings = <${sensors.join(' ')}>;`,
                )
            } else {
                diag.warn(
                    `layer "${layer.name}" encoder bindings need non-keypress behaviors; emit them manually`,
                    ['layers', li, 'encoders'],
                )
            }
        }
        lines.push(`        };`)
    })
    lines.push(`    };`)
    lines.push(`};`)
    lines.push(``)

    return [
        {
            filename: `${sanitize(config.keyboard.id || config.keyboard.name)}.keymap`,
            mime: 'text/plain',
            content: lines.join('\n'),
        },
        emitOverlay(config),
    ]
}

export const zmkCompiler: KeymapCompiler = {
    target: 'zmk',
    compile: (config) => runCompile(config, emitKeymap),
}

registerCompiler(zmkCompiler)
