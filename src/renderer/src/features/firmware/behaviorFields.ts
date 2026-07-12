// Pattern check: no GoF pattern (-) — rejected — descriptor tables (flavors,
// modifiers, field specs) plus pure diff / label helpers; nothing to abstract.
//
// Pure metadata + helpers for the custom hold-tap / mod-morph editor. The .tsx
// modal stays a thin view over these; the diff helpers turn edited local state
// back into the minimal Partial patch the concrete-service setters take.
import type { CanonHoldTapDef, CanonModMorph, Modifier } from '@firmware/config'
import { MODIFIERS } from '@firmware/config'
import type { FeatureName } from '@firmware/config'
import { LimitsFeature } from '@firmware/remappr/protocol'

export type Flavor = NonNullable<CanonHoldTapDef['flavor']>

export const FLAVOR_OPTIONS: readonly Flavor[] = [
    'balanced',
    'hold-preferred',
    'tap-preferred',
    'tap-unless-interrupted',
]

/** Editable numeric timing fields on a hold-tap def. */
export interface HoldTapNumField {
    key: 'tappingTermMs' | 'quickTapMs' | 'requirePriorIdleMs'
    label: string
    min: number
    max: number
}

export const HOLD_TAP_NUM_FIELDS: readonly HoldTapNumField[] = [
    { key: 'tappingTermMs', label: 'Tapping term', min: 1, max: 1000 },
    { key: 'quickTapMs', label: 'Quick tap', min: 0, max: 1000 },
    {
        key: 'requirePriorIdleMs',
        label: 'Require prior idle',
        min: 0,
        max: 1000,
    },
]

/** Editable boolean flags on a hold-tap def, with the firmware feature each needs
 *  (undefined ⇒ always honored). */
export interface HoldTapFlagField {
    key: 'retroTap' | 'holdTriggerOnRelease'
    label: string
    feature?: FeatureName
}

export const HOLD_TAP_FLAG_FIELDS: readonly HoldTapFlagField[] = [
    { key: 'retroTap', label: 'Retro tap' },
    {
        key: 'holdTriggerOnRelease',
        label: 'Trigger hold on release',
        feature: 'holdTriggerOnRelease',
    },
]

export const ALL_MODIFIERS: readonly Modifier[] = MODIFIERS

/** Short friendly label for a modifier, e.g. LEFT_CTRL → "LCtrl". */
export function modifierLabel(m: Modifier): string {
    const side = m.startsWith('LEFT_') ? 'L' : 'R'
    const name = m.replace(/^(LEFT|RIGHT)_/, '')
    const cap: Record<string, string> = {
        CTRL: 'Ctrl',
        SHIFT: 'Shift',
        ALT: 'Alt',
        GUI: 'Gui',
    }
    return side + (cap[name] ?? name)
}

/** Whether the connected firmware honors `feature` (undefined ⇒ always). */
export function featureSupported(
    feature: FeatureName | undefined,
    featureBitmask: number,
): boolean {
    if (!feature) return true
    return (featureBitmask & LimitsFeature[feature]) !== 0
}

/** Add/remove `m` from a modifier list (immutable). */
export function toggleModifier(list: Modifier[], m: Modifier): Modifier[] {
    return list.includes(m) ? list.filter((x) => x !== m) : [...list, m]
}

const sameSet = (a: Modifier[], b: Modifier[]): boolean =>
    a.length === b.length && a.every((m) => b.includes(m))

/** The changed editable fields of a hold-tap def as a patch, or null if nothing
 *  changed. `edited` carries the full editable surface (flavor + nums + flags). */
export function holdTapPatch(
    orig: CanonHoldTapDef,
    edited: CanonHoldTapDef,
): Partial<CanonHoldTapDef> | null {
    const patch: Partial<CanonHoldTapDef> = {}
    if (edited.flavor !== orig.flavor) patch.flavor = edited.flavor
    for (const f of HOLD_TAP_NUM_FIELDS)
        if (edited[f.key] !== orig[f.key]) patch[f.key] = edited[f.key]
    for (const f of HOLD_TAP_FLAG_FIELDS)
        if (!!edited[f.key] !== !!orig[f.key]) patch[f.key] = !!edited[f.key]
    return Object.keys(patch).length ? patch : null
}

/** The changed mods / keepMods of a mod-morph as a patch, or null if unchanged. */
export function modMorphPatch(
    orig: CanonModMorph,
    mods: Modifier[],
    keepMods: Modifier[],
): Partial<CanonModMorph> | null {
    const patch: Partial<CanonModMorph> = {}
    if (!sameSet(mods, orig.mods)) patch.mods = mods
    if (!sameSet(keepMods, orig.keepMods ?? [])) patch.keepMods = keepMods
    return Object.keys(patch).length ? patch : null
}
