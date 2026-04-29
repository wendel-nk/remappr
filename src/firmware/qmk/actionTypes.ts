// Pattern check: Adapter (Tier 1) — extended — backs src/firmware/adapter.ts FirmwareAdapter; static neutral ActionType[] for QMK/VIA action catalog.
import type { ActionType } from '@firmware/types'

const MODIFIER_VALUES = [
    { value: 0x01, label: 'LCTRL' },
    { value: 0x02, label: 'LSHIFT' },
    { value: 0x04, label: 'LALT' },
    { value: 0x08, label: 'LGUI' },
    { value: 0x10, label: 'RCTRL' },
    { value: 0x20, label: 'RSHIFT' },
    { value: 0x40, label: 'RALT' },
    { value: 0x80, label: 'RGUI' },
]

export const QMK_ACTION_TYPES: ActionType[] = [
    {
        id: 'qmk:none',
        displayName: 'None',
        description: 'No action (KC_NO).',
        slots: [],
    },
    {
        id: 'qmk:trans',
        displayName: 'Transparent',
        description: 'Pass-through (KC_TRNS).',
        slots: [],
    },
    {
        id: 'qmk:basic',
        displayName: 'Key Press',
        description: 'Send a basic HID keycode.',
        slots: [{ label: 'Key', kind: 'hid' }],
    },
    {
        id: 'qmk:mod-tap',
        displayName: 'Mod-Tap',
        description: 'Hold for modifier, tap for key.',
        slots: [
            { label: 'Hold', kind: 'modifier', values: MODIFIER_VALUES },
            { label: 'Tap', kind: 'hid' },
        ],
    },
    {
        id: 'qmk:layer-tap',
        displayName: 'Layer-Tap',
        description: 'Hold for layer, tap for key.',
        slots: [
            {
                label: 'Hold',
                kind: 'layer',
                range: { min: 0, max: 15 },
            },
            { label: 'Tap', kind: 'hid' },
        ],
    },
    {
        id: 'qmk:momentary',
        displayName: 'Momentary Layer',
        description: 'Activate layer while held (MO).',
        slots: [
            {
                label: 'Layer',
                kind: 'layer',
                range: { min: 0, max: 15 },
            },
        ],
    },
    {
        id: 'qmk:toggle-layer',
        displayName: 'Toggle Layer',
        description: 'Toggle layer (TG).',
        slots: [
            {
                label: 'Layer',
                kind: 'layer',
                range: { min: 0, max: 15 },
            },
        ],
    },
]
