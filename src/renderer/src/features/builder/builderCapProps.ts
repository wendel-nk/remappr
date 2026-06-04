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

/** Display props for one binding's cap, or null for an empty / transparent key
 *  (the canvas leaves those blank). */
export function builderCapProps(a: CanonAction | undefined): CapLegend | null {
    if (!a || a.type === 'transparent') return null
    switch (a.type) {
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
