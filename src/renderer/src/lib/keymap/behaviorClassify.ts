// Pattern check: no GoF pattern (-) — rejected — small ActionType displayName classifier helper (macro/combo/other), pure function, single classification rule.
//
// ZMK firmware reports user-defined `&macro_*` and `&combo_*` behaviors
// alongside system behaviors via listActionTypes(). They share the
// same ActionType shape, so we classify by displayName-derived binding
// name. The Macros / Combos catalog tabs render macro / combo
// behaviors as tiles; the action-type dropdown hides them so the user
// has one canonical pick path per behavior.
import type { ActionType } from '@firmware/types'
import { displayNameToBinding } from '@firmware/zmk/displayNameToBinding'

export type BehaviorClass = 'macro' | 'combo' | 'other'

export function classifyBehavior(at: ActionType): BehaviorClass {
    const binding = displayNameToBinding(at.displayName)
    if (binding.startsWith('&macro_')) return 'macro'
    if (binding.startsWith('&combo_')) return 'combo'
    // Loose fallback for non-ZMK firmwares that don't go through
    // displayNameToBinding — display name still hints macro / combo.
    const lower = at.displayName.toLowerCase()
    if (lower.includes('macro')) return 'macro'
    if (lower.includes('combo')) return 'combo'
    return 'other'
}

export const isMacroOrCombo = (at: ActionType): boolean =>
    classifyBehavior(at) !== 'other'
