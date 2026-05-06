// Pattern check: no GoF pattern (-) — rejected — small ActionType displayName classifier helper (macro/combo/other), pure function, single classification rule.
//
// ZMK firmware reports user-defined `&macro_*` (and any other custom
// behaviors) alongside system behaviors via listActionTypes(). They
// share the same ActionType shape, so we classify by:
//
//   1. id prefix — QMK/Vial/Keychron action types use `qmk:` / `vial:` /
//      `keychron:` prefixes; never user-defined macros.
//   2. displayNameToBinding lookup — if the binding lands in the known
//      system set (&kp, &mt, &mo, …), it's a system behavior.
//   3. anything left is a slug-fallback ZMK behavior — user-defined.
//      Default-classify as 'macro' since user macros are the dominant
//      runtime-defined behavior shape; explicit `&macro_` / `&combo_`
//      prefixes still take priority. ZMK combos aren't exposed through
//      listActionTypes (they're keymap config, not behaviors), so
//      'combo' here only fires when a user names a behavior accordingly.
import type { ActionType } from '@firmware/types'
import {
    displayNameToBinding,
    KNOWN_BINDING_PREFIXES,
} from '@firmware/zmk/displayNameToBinding'

export type BehaviorClass = 'macro' | 'combo' | 'other'

const SYSTEM_BINDING_SET: ReadonlySet<string> = new Set(KNOWN_BINDING_PREFIXES)

export function classifyBehavior(at: ActionType): BehaviorClass {
    if (at.id.includes(':')) return 'other'
    const binding = displayNameToBinding(at.displayName)
    if (binding.startsWith('&macro_')) return 'macro'
    if (binding.startsWith('&combo_')) return 'combo'
    if (binding && !SYSTEM_BINDING_SET.has(binding)) return 'macro'
    return 'other'
}

export const isMacroOrCombo = (at: ActionType): boolean =>
    classifyBehavior(at) !== 'other'
