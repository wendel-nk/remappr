// Pattern check: no GoF pattern (-) — rejected — static neutral ActionType[] for Vial action catalog; data only.
import { QMK_ACTION_TYPES } from '@firmware/qmk/actionTypes'
import type { ActionType } from '@firmware/types'

const VIAL_EXTRA: ActionType[] = [
    {
        id: 'vial:tap-dance',
        displayName: 'Tap Dance',
        description: 'Reference a configured tap-dance entry.',
        slots: [
            { label: 'Index', kind: 'number', range: { min: 0, max: 255 } },
        ],
    },
    {
        id: 'vial:macro',
        displayName: 'Dynamic Macro',
        description: 'Trigger a dynamic macro slot.',
        slots: [
            { label: 'Index', kind: 'number', range: { min: 0, max: 127 } },
        ],
    },
    {
        id: 'vial:reset',
        displayName: 'Bootloader',
        description: 'Reset to bootloader.',
        slots: [],
    },
]

export const VIAL_ACTION_TYPES: ActionType[] = [
    ...QMK_ACTION_TYPES,
    ...VIAL_EXTRA,
]
