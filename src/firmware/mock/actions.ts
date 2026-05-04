// pattern-check: skip — neutral action catalog for mock adapter
import type { ActionType, KeyAction, KeyLabel } from '@firmware/types'

export const MOCK_KIND_TRANSPARENT = 'mock:trans'
export const MOCK_KIND_KEYPRESS = 'mock:kp'
export const MOCK_KIND_LAYER_MOMENTARY = 'mock:mo'
export const MOCK_KIND_LAYER_TOGGLE = 'mock:tog'

// Renderer (`HidUsageLabel`, `KeycodePickerGrid`) consumes ZMK-style encoded
// usages: (page << 16) | id. Keep the mock adapter on the same encoding so
// the picker and label resolution work without a translation layer.
const HID_PAGE_KEYBOARD = 0x07
export const encodeHidUsage = (page: number, id: number): number =>
    (page << 16) | id
export const HID_KP = (id: number): number =>
    encodeHidUsage(HID_PAGE_KEYBOARD, id)

const HID_VALUES = (): { value: number; label: string }[] => {
    const out: { value: number; label: string }[] = []
    // A..Z (HID usage 0x04..0x1D)
    for (let i = 0; i < 26; i++) {
        out.push({
            value: HID_KP(0x04 + i),
            label: String.fromCharCode(65 + i),
        })
    }
    // 1..0 (HID usage 0x1E..0x27)
    const digits = '1234567890'
    for (let i = 0; i < digits.length; i++) {
        out.push({ value: HID_KP(0x1e + i), label: digits[i] })
    }
    out.push({ value: HID_KP(0x28), label: 'Enter' })
    out.push({ value: HID_KP(0x29), label: 'Esc' })
    out.push({ value: HID_KP(0x2a), label: 'Backspace' })
    out.push({ value: HID_KP(0x2b), label: 'Tab' })
    out.push({ value: HID_KP(0x2c), label: 'Space' })
    // Punctuation / nav (must round-trip from picker → label)
    out.push({ value: HID_KP(0x2d), label: '-' })
    out.push({ value: HID_KP(0x2e), label: '=' })
    out.push({ value: HID_KP(0x2f), label: '[' })
    out.push({ value: HID_KP(0x30), label: ']' })
    out.push({ value: HID_KP(0x31), label: '\\' })
    out.push({ value: HID_KP(0x33), label: ';' })
    out.push({ value: HID_KP(0x34), label: "'" })
    out.push({ value: HID_KP(0x35), label: '`' })
    out.push({ value: HID_KP(0x36), label: ',' })
    out.push({ value: HID_KP(0x37), label: '.' })
    out.push({ value: HID_KP(0x38), label: '/' })
    out.push({ value: HID_KP(0x39), label: 'CapsLk' })
    // F1..F12
    for (let i = 0; i < 12; i++) {
        out.push({ value: HID_KP(0x3a + i), label: `F${i + 1}` })
    }
    out.push({ value: HID_KP(0x4c), label: 'Del' })
    out.push({ value: HID_KP(0x4f), label: '→' })
    out.push({ value: HID_KP(0x50), label: '←' })
    out.push({ value: HID_KP(0x51), label: '↓' })
    out.push({ value: HID_KP(0x52), label: '↑' })
    return out
}

export function buildMockActionTypes(maxLayers: number): ActionType[] {
    return [
        {
            id: MOCK_KIND_TRANSPARENT,
            displayName: 'Transparent',
            description: 'Pass-through to lower layer',
            slots: [],
        },
        {
            id: MOCK_KIND_KEYPRESS,
            displayName: 'Key Press',
            description: 'Send a HID keycode',
            slots: [
                {
                    label: 'Key',
                    kind: 'hid',
                    values: HID_VALUES(),
                },
            ],
        },
        {
            id: MOCK_KIND_LAYER_MOMENTARY,
            displayName: 'Momentary Layer',
            description: 'Activate layer while held',
            slots: [
                {
                    label: 'Layer',
                    kind: 'layer',
                    range: { min: 0, max: maxLayers - 1 },
                },
            ],
        },
        {
            id: MOCK_KIND_LAYER_TOGGLE,
            displayName: 'Toggle Layer',
            description: 'Toggle layer on/off',
            slots: [
                {
                    label: 'Layer',
                    kind: 'layer',
                    range: { min: 0, max: maxLayers - 1 },
                },
            ],
        },
    ]
}

const HID_LABELS = new Map<number, string>(
    HID_VALUES().map((v) => [v.value, v.label]),
)

// ZMK convention (see src/firmware/zmk/actions.ts buildKeyLabel):
//   - label.primary       → behavior displayName (e.g. "Key Press") — shown
//                           as small header; identifies WHAT behavior fires.
//   - label.primaryUsage  → encoded HID usage rendered as the big glyph by
//                           HidUsageLabel in renderer.
//   - label.bindingPrefix → short binding token (e.g. "kp") for binding mode.
function labelFor(
    kind: string,
    params: number[],
    layerNames: string[],
): KeyLabel {
    if (kind === MOCK_KIND_TRANSPARENT) {
        return {
            primary: 'Transparent',
            bindingPrefix: 'trans',
        }
    }
    if (kind === MOCK_KIND_KEYPRESS) {
        const raw = params[0] ?? 0
        // Picker passes encoded usages; legacy callers may pass raw HID id.
        const encoded = raw >= 1 << 16 ? raw : HID_KP(raw)
        return {
            primary: 'Key Press',
            primaryUsage: encoded,
            bindingPrefix: 'kp',
            description: HID_LABELS.get(encoded) ?? `0x${encoded.toString(16)}`,
        }
    }
    if (kind === MOCK_KIND_LAYER_MOMENTARY) {
        const layer = params[0] ?? 0
        return {
            primary: 'Momentary Layer',
            secondary: layerNames[layer] ?? `L${layer}`,
            bindingPrefix: 'mo',
        }
    }
    if (kind === MOCK_KIND_LAYER_TOGGLE) {
        const layer = params[0] ?? 0
        return {
            primary: 'Toggle Layer',
            secondary: layerNames[layer] ?? `L${layer}`,
            bindingPrefix: 'tog',
        }
    }
    return { primary: '?' }
}

export function buildMockKeyAction(
    kind: string,
    params: number[],
    layerNames: string[] = [],
): KeyAction {
    return {
        kind,
        params: [...params],
        label: labelFor(kind, params, layerNames),
    }
}

export function relabelLayer(
    keys: KeyAction[],
    layerNames: string[],
): KeyAction[] {
    return keys.map((k) => buildMockKeyAction(k.kind, k.params, layerNames))
}
