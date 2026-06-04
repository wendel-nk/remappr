// Pattern check: no GoF pattern (-) — rejected — pure firmware-gated ActionType[]
// data tables + enum-action registry over CanonAction; data + builder fn, no
// abstraction.
//
// The Keyboard Builder reuses the editor's `KeyActionPicker` (one picker for the
// whole app). That picker is deviceless-capable but needs the neutral
// `ActionType[]` model the editor normally gets from `service.listActionTypes()`.
// The builder has no device, so this module synthesizes that list — firmware-
// gated from `keyboard.firmware` — covering the FULL CanonAction surface:
//   • key_press / sticky_key            → an `hid` slot (the keycode grid; mods
//                                         fold into the encoded value)
//   • mod_tap                           → hid Tap + modifier Hold
//   • layer_tap                         → hid Tap + layer Hold
//   • layer momentary/toggle/to/sticky  → a `layer` slot
//   • output / ext_power / lighting /   → an `enum` slot whose values map 1:1 to
//     mouse                               ready CanonActions (ENUM_ACTIONS below)
//   • macro / tap_dance                 → an `enum` slot of the config's refs
//   • caps_word/transparent/none/…      → nullary (no slots)
// The numeric encodings chosen here are decoded back to CanonAction by
// builderKeyActionBridge — the two files share these tables.

import type { ActionType } from '@firmware/types'
import type { CanonAction, CanonMacro, CanonTapDance } from '@firmware/config'
import { MODIFIERS } from '@firmware/config'
import type { Modifier } from '@firmware/config'
import { CATALOG_PAGES } from '@firmware/catalog/pages'
import type { KeyCatalog } from '@firmware/catalog/types'
import type { KeycodeCodec } from '@firmware/codec'
import { mockCodec } from '@firmware/mock/codec'
import { zmkCodec } from '@firmware/zmk/codec'
import { qmkCodec } from '@firmware/qmk/codec'

/* ── modifier slot encoding (index 0..7 = MODIFIERS order) ─────────────── */

const MOD_LABEL: Record<Modifier, string> = {
    LEFT_CTRL: 'LCtrl',
    LEFT_SHIFT: 'LShift',
    LEFT_ALT: 'LAlt',
    LEFT_GUI: 'LGui',
    RIGHT_CTRL: 'RCtrl',
    RIGHT_SHIFT: 'RShift',
    RIGHT_ALT: 'RAlt',
    RIGHT_GUI: 'RGui',
}

/** Modifier-slot value list (value = index into MODIFIERS). */
export const MOD_SLOT_VALUES = MODIFIERS.map((m, i) => ({
    value: i,
    label: MOD_LABEL[m],
}))

/* ── enum-action registry: one numeric value ⇒ one ready CanonAction ────── */

export type EnumKind = 'output' | 'ext_power' | 'lighting' | 'mouse'

export interface EnumActionDef {
    value: number
    label: string
    action: CanonAction
}

const out = (label: string, action: CanonAction): EnumActionDef => ({
    value: 0,
    label,
    action,
})

// Built without indices then numbered, so reordering can't desync value↔action.
const number = (defs: EnumActionDef[]): EnumActionDef[] =>
    defs.map((d, i) => ({ ...d, value: i }))

export const ENUM_ACTIONS: Record<EnumKind, EnumActionDef[]> = {
    output: number([
        out('USB', { type: 'output', action: 'usb' }),
        out('Bluetooth', { type: 'output', action: 'bluetooth' }),
        out('Output toggle', { type: 'output', action: 'toggle' }),
        out('BT next', { type: 'output', action: 'bluetooth_next' }),
        out('BT prev', { type: 'output', action: 'bluetooth_prev' }),
        out('BT clear', { type: 'output', action: 'bluetooth_clear' }),
        out('BT 0', { type: 'output', action: 'bluetooth', profile: 0 }),
        out('BT 1', { type: 'output', action: 'bluetooth', profile: 1 }),
        out('BT 2', { type: 'output', action: 'bluetooth', profile: 2 }),
        out('BT 3', { type: 'output', action: 'bluetooth', profile: 3 }),
    ]),
    ext_power: number([
        out('Power toggle', { type: 'ext_power', action: 'toggle' }),
        out('Power on', { type: 'ext_power', action: 'on' }),
        out('Power off', { type: 'ext_power', action: 'off' }),
    ]),
    lighting: number([
        out('RGB toggle', {
            type: 'lighting',
            target: 'underglow',
            action: 'toggle',
        }),
        out('RGB hue +', {
            type: 'lighting',
            target: 'underglow',
            action: 'hue_up',
        }),
        out('RGB sat +', {
            type: 'lighting',
            target: 'underglow',
            action: 'saturation_up',
        }),
        out('RGB bright +', {
            type: 'lighting',
            target: 'underglow',
            action: 'brightness_up',
        }),
        out('RGB effect →', {
            type: 'lighting',
            target: 'underglow',
            action: 'effect_next',
        }),
        out('Backlight toggle', {
            type: 'lighting',
            target: 'backlight',
            action: 'toggle',
        }),
        out('Backlight +', {
            type: 'lighting',
            target: 'backlight',
            action: 'brightness_up',
        }),
    ]),
    mouse: number([
        out('LMB', { type: 'mouse_key', button: 'left' }),
        out('RMB', { type: 'mouse_key', button: 'right' }),
        out('MMB', { type: 'mouse_key', button: 'middle' }),
        out('MB4', { type: 'mouse_key', button: 'mb4' }),
        out('MB5', { type: 'mouse_key', button: 'mb5' }),
        out('Move ↑', { type: 'mouse_move', direction: 'up' }),
        out('Move ↓', { type: 'mouse_move', direction: 'down' }),
        out('Move ←', { type: 'mouse_move', direction: 'left' }),
        out('Move →', { type: 'mouse_move', direction: 'right' }),
        out('Scroll ↑', { type: 'mouse_scroll', direction: 'up' }),
        out('Scroll ↓', { type: 'mouse_scroll', direction: 'down' }),
        out('Scroll ←', { type: 'mouse_scroll', direction: 'left' }),
        out('Scroll →', { type: 'mouse_scroll', direction: 'right' }),
    ]),
}

/* ── action-type kind ids ──────────────────────────────────────────────── */

// key_press / sticky_key / mod_tap / layer_tap / layer_* keep their CanonAction
// spelling; the enum + nullary kinds reuse the CanonAction `type` string so the
// bridge can round-trip a nullary action by its type alone.
export type BuilderKind =
    | 'key_press'
    | 'mod_tap'
    | 'layer_tap'
    | 'layer_momentary'
    | 'layer_toggle'
    | 'layer_to'
    | 'layer_sticky'
    | 'sticky_key'
    | EnumKind
    | 'macro'
    | 'tap_dance'
    | 'caps_word'
    | 'transparent'
    | 'none'
    | 'bootloader'
    | 'reset'
    | 'soft_off'
    | 'studio_unlock'
    | 'grave_escape'
    | 'key_repeat'

/* ── per-firmware capability gating ────────────────────────────────────── */

const COMMON: BuilderKind[] = [
    'key_press',
    'mod_tap',
    'layer_tap',
    'layer_momentary',
    'layer_toggle',
    'layer_to',
    'transparent',
    'none',
    'caps_word',
    'mouse',
    'macro',
]

const FW_KINDS: Record<string, BuilderKind[]> = {
    zmk: [
        ...COMMON,
        'layer_sticky',
        'sticky_key',
        'output',
        'ext_power',
        'lighting',
        'key_repeat',
        'reset',
        'bootloader',
        'studio_unlock',
        'soft_off',
    ],
    qmk: [
        ...COMMON,
        'layer_sticky',
        'sticky_key',
        'tap_dance',
        'lighting',
        'grave_escape',
        'key_repeat',
        'reset',
        'bootloader',
    ],
    vial: [
        ...COMMON,
        'layer_sticky',
        'sticky_key',
        'tap_dance',
        'lighting',
        'grave_escape',
        'key_repeat',
        'reset',
        'bootloader',
    ],
    via: [...COMMON, 'lighting', 'reset', 'bootloader'],
}

// Display order + labels, independent of firmware.
const KIND_ORDER: { kind: BuilderKind; label: string }[] = [
    { kind: 'key_press', label: 'Key Press' },
    { kind: 'mod_tap', label: 'Mod-Tap' },
    { kind: 'layer_tap', label: 'Layer-Tap' },
    { kind: 'layer_momentary', label: 'Momentary Layer' },
    { kind: 'layer_toggle', label: 'Toggle Layer' },
    { kind: 'layer_to', label: 'To Layer' },
    { kind: 'layer_sticky', label: 'Sticky / One-Shot Layer' },
    { kind: 'sticky_key', label: 'Sticky Key' },
    { kind: 'mouse', label: 'Mouse' },
    { kind: 'output', label: 'Output / Bluetooth' },
    { kind: 'ext_power', label: 'External Power' },
    { kind: 'lighting', label: 'Lighting' },
    { kind: 'macro', label: 'Macro' },
    { kind: 'tap_dance', label: 'Tap Dance' },
    { kind: 'caps_word', label: 'Caps Word' },
    { kind: 'key_repeat', label: 'Key Repeat' },
    { kind: 'grave_escape', label: 'Grave Escape' },
    { kind: 'studio_unlock', label: 'Studio Unlock' },
    { kind: 'soft_off', label: 'Soft Off' },
    { kind: 'bootloader', label: 'Bootloader' },
    { kind: 'reset', label: 'Reset' },
    { kind: 'transparent', label: 'Transparent' },
    { kind: 'none', label: 'None' },
]

const HID_SLOT = { label: 'Key', kind: 'hid' as const }

/** Slots for one action-type kind. */
function slotsFor(
    kind: BuilderKind,
    macros: CanonMacro[],
    tapDances: CanonTapDance[],
): ActionType['slots'] {
    switch (kind) {
        case 'key_press':
        case 'sticky_key':
            return [HID_SLOT]
        case 'mod_tap':
            return [
                { label: 'Tap', kind: 'hid' },
                { label: 'Hold', kind: 'modifier', values: MOD_SLOT_VALUES },
            ]
        case 'layer_tap':
            return [
                { label: 'Tap', kind: 'hid' },
                { label: 'Hold', kind: 'layer' },
            ]
        case 'layer_momentary':
        case 'layer_toggle':
        case 'layer_to':
        case 'layer_sticky':
            return [{ label: 'Layer', kind: 'layer' }]
        case 'output':
        case 'ext_power':
        case 'lighting':
        case 'mouse':
            return [
                {
                    label: KIND_ORDER.find((k) => k.kind === kind)!.label,
                    kind: 'enum',
                    values: ENUM_ACTIONS[kind].map((d) => ({
                        value: d.value,
                        label: d.label,
                    })),
                },
            ]
        case 'macro':
            return macros.length
                ? [
                      {
                          label: 'Macro',
                          kind: 'enum',
                          values: macros.map((m, i) => ({
                              value: i,
                              label: m.id,
                          })),
                      },
                  ]
                : []
        case 'tap_dance':
            return tapDances.length
                ? [
                      {
                          label: 'Tap dance',
                          kind: 'enum',
                          values: tapDances.map((t, i) => ({
                              value: i,
                              label: t.id,
                          })),
                      },
                  ]
                : []
        default:
            return [] // nullary system actions
    }
}

const resolveTargets = (targets: string[] | undefined): string[] => {
    const t = (targets ?? []).filter((id) => id in FW_KINDS)
    return t.length ? t : ['qmk']
}

/** Firmware-gated ActionType[] for the builder's binding picker (union of the
 *  selected targets, in canonical display order). Macro / tap-dance options come
 *  from the config's defined refs. */
export function builderActionTypes(
    targets: string[] | undefined,
    macros: CanonMacro[] = [],
    tapDances: CanonTapDance[] = [],
): ActionType[] {
    const t = resolveTargets(targets)
    const allowed = new Set<BuilderKind>()
    for (const id of t) for (const k of FW_KINDS[id]) allowed.add(k)
    // Drop macro / tap_dance when the config defines none (no refs to pick).
    if (!macros.length) allowed.delete('macro')
    if (!tapDances.length) allowed.delete('tap_dance')
    return KIND_ORDER.filter((k) => allowed.has(k.kind)).map(
        ({ kind, label }) => ({
            id: kind,
            displayName: label,
            slots: slotsFor(kind, macros, tapDances),
        }),
    )
}

/* ── firmware-filtered keycode grid catalog ────────────────────────────── */

// One real codec per firmware family (via/vial compile through QMK).
const FW_CODEC: Record<string, KeycodeCodec> = {
    zmk: zmkCodec,
    qmk: qmkCodec,
    via: qmkCodec,
    vial: qmkCodec,
}

// pattern-check: skip additive pure catalog filter, no new logic class
/** Keycode-grid catalog for the builder, gated to the selected firmware. A key
 *  shows when it is BOTH HID-pickable (the deviceless grid encodes via the
 *  HID-usage mockCodec) AND valid on at least one selected firmware — so picking
 *  ZMK drops QMK-only keys and vice-versa, while firmware behaviours (BT / RGB /
 *  power) stay in the action-type list, not the grid. */
export function builderKeycodeCatalog(
    targets: string[] | undefined,
): KeyCatalog {
    const t = resolveTargets(targets)
    const codecs = t.map((id) => FW_CODEC[id]).filter(Boolean)
    const supported = (id: string): boolean =>
        mockCodec.supports(id) && codecs.some((c) => c.supports(id))
    return {
        pages: CATALOG_PAGES.map((p) => ({
            ...p,
            entries: p.entries.filter((e) => supported(e.id)),
        })).filter((p) => p.entries.length > 0),
    }
}
