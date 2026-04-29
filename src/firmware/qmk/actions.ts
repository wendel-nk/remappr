// Pattern check: no GoF pattern (-) — rejected — pure 16-bit QMK keycode encode/decode + label generation; helper functions only.
// QMK 16-bit keycode encoding/decoding for the action kinds the QMK adapter supports.
// Reference: https://docs.qmk.fm/keycodes (Quantum keycode ranges).

import type { ActionType, KeyAction, KeyLabel } from '@firmware/types'
import { ProtocolError } from '@firmware/errors'

import { QMK_ACTION_TYPES } from './actionTypes'

// QMK kind ids — match action catalog in actionTypes.ts.
export const QMK_KIND = {
    NONE: 'qmk:none',
    TRANS: 'qmk:trans',
    BASIC: 'qmk:basic',
    MOD_TAP: 'qmk:mod-tap',
    LAYER_TAP: 'qmk:layer-tap',
    MOMENTARY: 'qmk:momentary',
    TOGGLE_LAYER: 'qmk:toggle-layer',
} as const

// Quantum keycode range bases.
const QK_BASIC_MAX = 0x00ff
const QK_LAYER_TAP = 0x4000
const QK_LAYER_TAP_MAX = 0x4fff
const QK_MOMENTARY = 0x5100
const QK_TOGGLE_LAYER = 0x5300
const QK_MOD_TAP = 0x6000
const QK_MOD_TAP_MAX = 0x7fff

// Modifier mask bits (5-bit packed: lower 4 = mod, bit 4 = isRight).
// VIA mod params we expose match QMK's MOD_BIT() values: 0x01..0x80.
const MOD_BIT_TO_PACKED: Record<number, number> = {
    0x01: 0b00001, // LCTRL
    0x02: 0b00010, // LSHIFT
    0x04: 0b00100, // LALT
    0x08: 0b01000, // LGUI
    0x10: 0b10001, // RCTRL
    0x20: 0b10010, // RSHIFT
    0x40: 0b10100, // RALT
    0x80: 0b11000, // RGUI
}

const PACKED_TO_MOD_BIT: Record<number, number> = Object.fromEntries(
    Object.entries(MOD_BIT_TO_PACKED).map(([k, v]) => [v, Number(k)]),
)

const BASIC_KEY_NAMES: Record<number, string> = {
    0x00: 'KC_NO',
    0x29: 'Esc',
    0x2a: 'Bspc',
    0x2b: 'Tab',
    0x2c: 'Space',
    0x28: 'Enter',
    0x4c: 'Del',
    0x39: 'Caps',
    0x4f: '→',
    0x50: '←',
    0x51: '↓',
    0x52: '↑',
    0x36: ',',
    0x37: '.',
    0x38: '/',
    0x33: ';',
    0x34: "'",
    0x35: '`',
    0x2d: '-',
    0x2e: '=',
    0x2f: '[',
    0x30: ']',
    0x31: '\\',
}

const MOD_LABELS: Record<number, string> = {
    0x01: 'LCtrl',
    0x02: 'LShift',
    0x04: 'LAlt',
    0x08: 'LGui',
    0x10: 'RCtrl',
    0x20: 'RShift',
    0x40: 'RAlt',
    0x80: 'RGui',
}

function basicKeyLabel(code: number): string {
    if (code === 0) return 'No'
    const named = BASIC_KEY_NAMES[code]
    if (named) return named
    if (code >= 0x04 && code <= 0x1d) {
        return String.fromCharCode('A'.charCodeAt(0) + (code - 0x04))
    }
    if (code === 0x27) return '0'
    if (code >= 0x1e && code <= 0x26) {
        return String.fromCharCode('1'.charCodeAt(0) + (code - 0x1e))
    }
    if (code >= 0x3a && code <= 0x45) {
        return `F${code - 0x39}`
    }
    return `0x${code.toString(16).padStart(2, '0')}`
}

function modLabel(modBit: number): string {
    return MOD_LABELS[modBit] ?? `mod 0x${modBit.toString(16)}`
}

function layerName(layer: number, layerNames?: string[]): string {
    if (layerNames && layerNames[layer]) return layerNames[layer]
    return `L${layer}`
}

export function buildLabel(
    kind: string,
    params: number[],
    layerNames?: string[],
): KeyLabel {
    switch (kind) {
        case QMK_KIND.NONE:
            return { primary: 'No', description: 'KC_NO' }
        case QMK_KIND.TRANS:
            return { primary: '▽', description: 'Transparent (KC_TRNS)' }
        case QMK_KIND.BASIC: {
            const code = params[0] ?? 0
            const primary = basicKeyLabel(code)
            return {
                primary,
                primaryUsage: code,
                description: `Basic 0x${code.toString(16).padStart(2, '0')}`,
            }
        }
        case QMK_KIND.MOD_TAP: {
            const mod = params[0] ?? 0
            const tap = params[1] ?? 0
            return {
                primary: basicKeyLabel(tap),
                secondary: modLabel(mod),
                description: `MT(${modLabel(mod)}, ${basicKeyLabel(tap)})`,
            }
        }
        case QMK_KIND.LAYER_TAP: {
            const layer = params[0] ?? 0
            const tap = params[1] ?? 0
            return {
                primary: basicKeyLabel(tap),
                secondary: layerName(layer, layerNames),
                description: `LT(${layerName(layer, layerNames)}, ${basicKeyLabel(tap)})`,
            }
        }
        case QMK_KIND.MOMENTARY: {
            const layer = params[0] ?? 0
            return {
                primary: `MO ${layerName(layer, layerNames)}`,
                description: `MO(${layer})`,
            }
        }
        case QMK_KIND.TOGGLE_LAYER: {
            const layer = params[0] ?? 0
            return {
                primary: `TG ${layerName(layer, layerNames)}`,
                description: `TG(${layer})`,
            }
        }
        default:
            return { primary: kind }
    }
}

export function buildQmkKeyAction(
    kind: string,
    params: number[],
    layerNames?: string[],
): KeyAction {
    return {
        kind,
        params: [...params],
        label: buildLabel(kind, params, layerNames),
    }
}

// Encode a neutral KeyAction → 16-bit QMK keycode.
export function encodeKeycode(action: KeyAction): number {
    const p = action.params
    switch (action.kind) {
        case QMK_KIND.NONE:
            return 0x0000
        case QMK_KIND.TRANS:
            return 0x0001
        case QMK_KIND.BASIC:
            return (p[0] ?? 0) & QK_BASIC_MAX
        case QMK_KIND.MOD_TAP: {
            const modBit = p[0] ?? 0
            const packed = MOD_BIT_TO_PACKED[modBit] ?? 0
            const tap = (p[1] ?? 0) & 0xff
            return QK_MOD_TAP | (packed << 8) | tap
        }
        case QMK_KIND.LAYER_TAP: {
            const layer = (p[0] ?? 0) & 0x0f
            const tap = (p[1] ?? 0) & 0xff
            return QK_LAYER_TAP | (layer << 8) | tap
        }
        case QMK_KIND.MOMENTARY:
            return QK_MOMENTARY | ((p[0] ?? 0) & 0x1f)
        case QMK_KIND.TOGGLE_LAYER:
            return QK_TOGGLE_LAYER | ((p[0] ?? 0) & 0x1f)
        default:
            throw new ProtocolError(
                `qmk encode: unsupported kind ${action.kind}`,
            )
    }
}

export interface DecodedKeycode {
    kind: string
    params: number[]
}

// Decode a 16-bit QMK keycode → neutral kind + params.
export function decodeKeycode(kc: number): DecodedKeycode {
    const code = kc & 0xffff
    if (code === 0x0000) return { kind: QMK_KIND.NONE, params: [] }
    if (code === 0x0001) return { kind: QMK_KIND.TRANS, params: [] }
    if (code <= QK_BASIC_MAX) {
        return { kind: QMK_KIND.BASIC, params: [code] }
    }
    if (code >= QK_MOD_TAP && code <= QK_MOD_TAP_MAX) {
        const packed = (code >> 8) & 0x1f
        const modBit = PACKED_TO_MOD_BIT[packed] ?? 0
        return { kind: QMK_KIND.MOD_TAP, params: [modBit, code & 0xff] }
    }
    if (code >= QK_LAYER_TAP && code <= QK_LAYER_TAP_MAX) {
        const layer = (code >> 8) & 0x0f
        return { kind: QMK_KIND.LAYER_TAP, params: [layer, code & 0xff] }
    }
    if (code >= QK_MOMENTARY && code <= QK_MOMENTARY + 0x1f) {
        return { kind: QMK_KIND.MOMENTARY, params: [code & 0x1f] }
    }
    if (code >= QK_TOGGLE_LAYER && code <= QK_TOGGLE_LAYER + 0x1f) {
        return { kind: QMK_KIND.TOGGLE_LAYER, params: [code & 0x1f] }
    }
    // Fallback: treat as raw basic; loses fidelity but never throws.
    return { kind: QMK_KIND.BASIC, params: [code & 0xff] }
}

export function decodeAsKeyAction(
    kc: number,
    layerNames?: string[],
): KeyAction {
    const { kind, params } = decodeKeycode(kc)
    return buildQmkKeyAction(kind, params, layerNames)
}

export function relabelQmkLayer(
    keys: KeyAction[],
    layerNames: string[],
): KeyAction[] {
    return keys.map((k) => ({
        ...k,
        label: buildLabel(k.kind, k.params, layerNames),
    }))
}

export function getActionTypes(): ActionType[] {
    return QMK_ACTION_TYPES
}
