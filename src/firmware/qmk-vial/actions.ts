// Pattern check: Adapter (Tier 1) — extended — extends src/firmware/qmk/actions.ts decoder; adds Vial-specific keycode ranges layered before falling back to QMK.
// Vial adds tap-dance, dynamic-macro, and a reset keycode on top of QMK's 16-bit space.
// Reference: vial-gui keycodes/keycodes.py and QMK quantum keycode docs.

import { ProtocolError } from '@firmware/errors'
import {
    QMK_KIND,
    buildLabel as buildQmkLabel,
    buildQmkKeyAction,
    decodeKeycode as decodeQmkKeycode,
    encodeKeycode as encodeQmkKeycode,
} from '@firmware/qmk/actions'
import type { KeyAction, KeyLabel } from '@firmware/types'

export const VIAL_KIND = {
    TAP_DANCE: 'vial:tap-dance',
    MACRO: 'vial:macro',
    RESET: 'vial:reset',
} as const

const QK_RESET = 0x5c00
const QK_TAP_DANCE = 0x5700
const QK_TAP_DANCE_MAX = 0x57ff
const QK_MACRO = 0x7700
const QK_MACRO_MAX = 0x777f

function buildVialLabel(kind: string, params: number[]): KeyLabel {
    switch (kind) {
        case VIAL_KIND.TAP_DANCE:
            return {
                primary: `TD ${params[0] ?? 0}`,
                description: `Tap-dance #${params[0] ?? 0}`,
            }
        case VIAL_KIND.MACRO:
            return {
                primary: `M${params[0] ?? 0}`,
                description: `Dynamic macro #${params[0] ?? 0}`,
            }
        case VIAL_KIND.RESET:
            return { primary: 'Reset', description: 'Jump to bootloader' }
        default:
            return buildQmkLabel(kind, params)
    }
}

export function buildVialKeyAction(
    kind: string,
    params: number[],
    layerNames?: string[],
): KeyAction {
    if (
        kind === VIAL_KIND.TAP_DANCE ||
        kind === VIAL_KIND.MACRO ||
        kind === VIAL_KIND.RESET
    ) {
        return {
            kind,
            params: [...params],
            label: buildVialLabel(kind, params),
        }
    }
    return buildQmkKeyAction(kind, params, layerNames)
}

export function decodeVialKeycode(kc: number): {
    kind: string
    params: number[]
} {
    const code = kc & 0xffff
    if (code === QK_RESET) return { kind: VIAL_KIND.RESET, params: [] }
    if (code >= QK_TAP_DANCE && code <= QK_TAP_DANCE_MAX) {
        return { kind: VIAL_KIND.TAP_DANCE, params: [code & 0xff] }
    }
    if (code >= QK_MACRO && code <= QK_MACRO_MAX) {
        return { kind: VIAL_KIND.MACRO, params: [code & 0x7f] }
    }
    return decodeQmkKeycode(code)
}

export function encodeVialKeycode(action: KeyAction): number {
    switch (action.kind) {
        case VIAL_KIND.RESET:
            return QK_RESET
        case VIAL_KIND.TAP_DANCE:
            return (QK_TAP_DANCE | ((action.params[0] ?? 0) & 0xff)) & 0xffff
        case VIAL_KIND.MACRO:
            return (QK_MACRO | ((action.params[0] ?? 0) & 0x7f)) & 0xffff
        default:
            return encodeQmkKeycode(action)
    }
}

export function decodeVialAsKeyAction(
    kc: number,
    layerNames?: string[],
): KeyAction {
    const { kind, params } = decodeVialKeycode(kc)
    return buildVialKeyAction(kind, params, layerNames)
}

export function relabelVialLayer(
    keys: KeyAction[],
    layerNames: string[],
): KeyAction[] {
    return keys.map((k) => {
        const isVial =
            k.kind === VIAL_KIND.TAP_DANCE ||
            k.kind === VIAL_KIND.MACRO ||
            k.kind === VIAL_KIND.RESET
        return {
            ...k,
            label: isVial
                ? buildVialLabel(k.kind, k.params)
                : buildQmkLabel(k.kind, k.params, layerNames),
        }
    })
}

export function ensureEncodable(action: KeyAction): void {
    // Throw early if a kind cannot be serialized — keeps setKey from sending
    // nonsense bytes to firmware.
    const supported = new Set<string>([
        QMK_KIND.NONE,
        QMK_KIND.TRANS,
        QMK_KIND.BASIC,
        QMK_KIND.MOD_TAP,
        QMK_KIND.LAYER_TAP,
        QMK_KIND.MOMENTARY,
        QMK_KIND.TOGGLE_LAYER,
        VIAL_KIND.TAP_DANCE,
        VIAL_KIND.MACRO,
        VIAL_KIND.RESET,
    ])
    if (!supported.has(action.kind)) {
        throw new ProtocolError(`vial encode: unsupported kind ${action.kind}`)
    }
}
