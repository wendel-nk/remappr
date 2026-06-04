// Pattern check: no GoF pattern (-) — rejected — pure CanonAction → KeyButton
// legend-prop mapping reusing mockCodec/usageGlyph/categoryForUsage; data
// transform, no abstraction.
//
// The builder canvas + inspector render caps through the production `KeyButton`,
// which wants display props (tap glyph, action-type header, category, hold-tap
// labels) — not a raw `CanonAction`. This derives those props for every
// CanonAction variant so a bound key actually shows on the cap (HID keys via the
// HID-usage mockCodec + the editor's usageGlyph/categoryForUsage helpers; layer /
// macro / system actions get a short token + a fixed category).

import { mockCodec } from '@firmware/mock/codec'
import { friendlyName } from '@firmware/config'
import type { CanonAction, Modifier } from '@firmware/config'
import { usageGlyph } from '@/lib/actions/hidUsages'
import { categoryForUsage, type KeyCategory } from '@/lib/keymap/keyCategory'
import type { HoldTapLabels } from '@/features/keymap/keyboard/KeyButton'
import { ENUM_ACTIONS, type EnumKind } from './builderActionTypes'

export interface CapLegend {
    tapText: string
    header?: string
    category: KeyCategory
    accentCategory?: KeyCategory
    holdTap?: HoldTapLabels
}

const MOD_SHORT: Record<Modifier, string> = {
    LEFT_CTRL: 'Ctrl',
    LEFT_SHIFT: 'Shift',
    LEFT_ALT: 'Alt',
    LEFT_GUI: 'Gui',
    RIGHT_CTRL: 'Ctrl',
    RIGHT_SHIFT: 'Shift',
    RIGHT_ALT: 'Alt',
    RIGHT_GUI: 'Gui',
}

const keyGlyph = (key: string): string => {
    const v = mockCodec.encode(key)?.value
    return v !== undefined ? usageGlyph(v) : friendlyName(key)
}
const keyCat = (key: string): KeyCategory => {
    const v = mockCodec.encode(key)?.value
    return v !== undefined ? categoryForUsage(v) : 'alpha'
}

const enumLabel = (kind: EnumKind, a: CanonAction): string => {
    const j = JSON.stringify(a)
    const def = ENUM_ACTIONS[kind].find((d) => JSON.stringify(d.action) === j)
    return def?.label ?? kind
}

const LAYER_HEADER: Record<string, string> = {
    momentary: 'Momentary',
    toggle: 'Toggle',
    to: 'To Layer',
    sticky: 'Sticky',
}

// pattern-check: skip thin per-firmware dispatch over two pure token maps, no abstraction
/** The binding-code token KeyButton shows as the header in "Binding code" mode
 *  (the param stays the cap glyph, matching the editor's device binding prefix).
 *  Firmware-aware: ZMK behavior tokens (&kp, &mt, &mo) vs QMK keycode prefixes
 *  (KC, MT, MO). `firmware` is the builder's multi-select target list; ZMK wins
 *  when present, else QMK. Undefined for an absent binding (or an action with no
 *  token on that firmware → header falls back to the action name). */
export function builderBindingCode(
    a: CanonAction | undefined,
    firmware?: string[],
): string | undefined {
    if (!a) return undefined
    const qmk = firmware ? !firmware.includes('zmk') : false
    return qmk ? qmkBindingCode(a) : zmkBindingCode(a)
}

// pattern-check: skip pure CanonAction → ZMK behavior-token map, no abstraction
function zmkBindingCode(a: CanonAction): string | undefined {
    switch (a.type) {
        case 'key_press':
            return '&kp'
        case 'sticky_key':
            return '&sk'
        case 'key_toggle':
            return '&kt'
        case 'tap_hold':
            return a.hold.type === 'modifier' ? '&mt' : '&lt'
        case 'layer':
            return a.mode === 'momentary'
                ? '&mo'
                : a.mode === 'toggle'
                  ? '&tog'
                  : a.mode === 'to'
                    ? '&to'
                    : '&sl'
        case 'macro':
        case 'tap_dance':
            return `&${a.ref}`
        case 'mod_morph':
        case 'hold_tap':
            return `&${a.ref}`
        case 'output':
            return a.action.startsWith('bluetooth') ? '&bt' : '&out'
        case 'ext_power':
            return '&ext_power'
        case 'lighting':
            return a.target === 'backlight' ? '&bl' : '&rgb_ug'
        case 'mouse_key':
            return '&mkp'
        case 'mouse_move':
            return '&mmv'
        case 'mouse_scroll':
            return '&msc'
        case 'caps_word':
            return '&caps_word'
        case 'key_repeat':
            return '&key_repeat'
        case 'grave_escape':
            return '&gresc'
        case 'bootloader':
            return '&bootloader'
        case 'reset':
            return '&sys_reset'
        case 'soft_off':
            return '&soft_off'
        case 'studio_unlock':
            return '&studio_unlock'
        case 'transparent':
            return '&trans'
        case 'none':
            return '&none'
        default:
            return undefined
    }
}

// pattern-check: skip pure CanonAction → QMK keycode-prefix map, no abstraction
// QMK has no behavior-prefix model like ZMK's &kp; the editor surfaces "KC" as
// the binding code. Map each action to its closest QMK keycode/macro prefix;
// ZMK-only actions (output/ext_power/soft_off/…) return undefined so the header
// falls back to the action name on a QMK target.
function qmkBindingCode(a: CanonAction): string | undefined {
    switch (a.type) {
        case 'key_press':
            return 'KC'
        case 'sticky_key':
            return 'OSM'
        case 'tap_hold':
            return a.hold.type === 'modifier' ? 'MT' : 'LT'
        case 'layer':
            return a.mode === 'momentary'
                ? 'MO'
                : a.mode === 'toggle'
                  ? 'TG'
                  : a.mode === 'to'
                    ? 'TO'
                    : 'OSL'
        case 'macro':
        case 'tap_dance':
        case 'mod_morph':
        case 'hold_tap':
            return a.ref
        case 'mouse_key':
        case 'mouse_move':
        case 'mouse_scroll':
            return 'KC_MS'
        case 'caps_word':
            return 'CW_TOGG'
        case 'key_repeat':
            return 'QK_REP'
        case 'grave_escape':
            return 'QK_GESC'
        case 'bootloader':
            return 'QK_BOOT'
        case 'reset':
            return 'QK_RBT'
        case 'transparent':
            return 'KC_TRNS'
        case 'none':
            return 'KC_NO'
        default:
            return undefined
    }
}

// pattern-check: skip add one transparent switch case to existing pure mapping fn, no abstraction
/** Display props for one binding's cap, or null for an absent binding (the
 *  canvas leaves those blank). Transparent renders the ▽ pass-through glyph to
 *  match the editor — only a truly missing binding is blank. */
export function builderCapProps(a: CanonAction | undefined): CapLegend | null {
    if (!a) return null
    switch (a.type) {
        case 'transparent':
            return { tapText: '▽', category: 'trans' }
        case 'key_press':
            return {
                tapText: keyGlyph(a.key),
                header: a.mods?.length
                    ? a.mods.map((m) => MOD_SHORT[m]).join('+') + '+'
                    : 'Key Press',
                category: keyCat(a.key),
                accentCategory: a.mods?.length ? 'mod' : undefined,
            }
        case 'sticky_key':
            return {
                tapText: keyGlyph(a.key),
                header: 'Sticky',
                category: keyCat(a.key),
                accentCategory: 'mod',
            }
        case 'tap_hold': {
            const tap = keyGlyph(a.tap.key)
            const hold =
                a.hold.type === 'modifier'
                    ? MOD_SHORT[a.hold.modifier]
                    : a.hold.layer
            return {
                tapText: tap,
                header: a.hold.type === 'modifier' ? 'Mod-Tap' : 'Layer-Tap',
                category: keyCat(a.tap.key),
                accentCategory: a.hold.type === 'modifier' ? 'mod' : 'layer',
                holdTap: { tap, hold },
            }
        }
        case 'layer':
            return {
                tapText: a.layer,
                header: LAYER_HEADER[a.mode] ?? 'Layer',
                category: 'layer',
            }
        case 'macro':
            return { tapText: a.ref, header: 'Macro', category: 'system' }
        case 'tap_dance':
            return { tapText: a.ref, header: 'Tap Dance', category: 'system' }
        case 'output':
        case 'ext_power':
        case 'lighting':
            return {
                tapText: enumLabel(a.type, a),
                header:
                    a.type === 'output'
                        ? 'Output'
                        : a.type === 'ext_power'
                          ? 'Power'
                          : 'Lighting',
                category: 'system',
            }
        case 'mouse_key':
        case 'mouse_move':
        case 'mouse_scroll':
            return {
                tapText: enumLabel('mouse', a),
                header: 'Mouse',
                category: 'mouse',
            }
        case 'caps_word':
            return { tapText: 'Caps', header: 'Caps Word', category: 'mod' }
        case 'key_repeat':
            return { tapText: 'Rept', header: 'Repeat', category: 'edit' }
        case 'grave_escape':
            return { tapText: '~Esc', header: 'Grave Esc', category: 'edit' }
        case 'bootloader':
            return { tapText: 'Boot', header: 'Bootloader', category: 'system' }
        case 'reset':
            return { tapText: 'Reset', header: 'Reset', category: 'system' }
        case 'soft_off':
            return { tapText: 'Off', header: 'Soft Off', category: 'system' }
        case 'studio_unlock':
            return { tapText: 'Studio', header: 'Unlock', category: 'system' }
        case 'none':
            return { tapText: '✕', header: 'None', category: 'trans' }
        default:
            return { tapText: String(a.type), category: 'system' }
    }
}
