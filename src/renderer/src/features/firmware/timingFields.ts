// Pattern check: no GoF pattern (-) — rejected — a declarative field-descriptor
// table plus two pure helpers; no polymorphism or construction to abstract.
//
// Single source of truth for the config-blob timing/defaults editor. Each
// descriptor names a `ConfigDefaults` field (mirrors the zod `defaults` schema),
// its UI label/range/group, and the `LimitsFeature` bit the firmware must
// advertise to honor it (undefined = a core field every remappr build honors).
// The exhaustiveness guard below fails the build if `ConfigDefaults` gains a
// field that isn't listed here, so the editor can never silently drop one.
import type { ConfigDefaults, FeatureName } from '@firmware/config'
import { LimitsFeature } from '@firmware/remappr/protocol'

export type TimingFieldKey = keyof ConfigDefaults

export interface TimingFieldDef {
    key: TimingFieldKey
    label: string
    description: string
    group: string
    min: number
    max: number
    /** Firmware feature bit required to honor this field; undefined ⇒ always
     *  honored (core timing / pre-§7.4.1 debounce). */
    feature?: FeatureName
}

const GROUP_TAP = 'Tap-hold & combo'
const GROUP_DEBOUNCE = 'Debounce'
const GROUP_ENGINE = 'Engine timing (§7.4.1)'

export const TIMING_FIELDS = [
    {
        key: 'tappingTermMs',
        label: 'Tapping term',
        description: 'Hold-vs-tap decision window.',
        group: GROUP_TAP,
        min: 1,
        max: 1000,
    },
    {
        key: 'quickTapMs',
        label: 'Quick tap',
        description: 'Tap-then-hold within this window repeats the tap.',
        group: GROUP_TAP,
        min: 0,
        max: 1000,
    },
    {
        key: 'comboTimeoutMs',
        label: 'Combo timeout',
        description: 'Max time between the keys of a combo.',
        group: GROUP_TAP,
        min: 1,
        max: 1000,
    },
    {
        key: 'releaseDebounceMs',
        label: 'Release debounce',
        description: '0 keeps the firmware / devicetree value.',
        group: GROUP_DEBOUNCE,
        min: 0,
        max: 80,
    },
    {
        key: 'pressDebounceMs',
        label: 'Press debounce',
        description: '0 keeps the firmware / devicetree value.',
        group: GROUP_DEBOUNCE,
        min: 0,
        max: 80,
    },
    {
        key: 'matrixPressDebounceMs',
        label: 'Matrix press debounce',
        description: '0 keeps the firmware / devicetree value.',
        group: GROUP_DEBOUNCE,
        min: 0,
        max: 80,
    },
    {
        key: 'matrixReleaseDebounceMs',
        label: 'Matrix release debounce',
        description: '0 keeps the firmware / devicetree value.',
        group: GROUP_DEBOUNCE,
        min: 0,
        max: 80,
    },
    {
        key: 'capsWordIdleMs',
        label: 'Caps-word idle',
        description: 'Auto-exit caps-word after this idle time; 0 = never.',
        group: GROUP_ENGINE,
        min: 0,
        max: 5000,
        feature: 'capsWordIdle',
    },
    {
        key: 'stickyReleaseDefaultMs',
        label: 'Sticky release',
        description: 'Sticky-key lifetime; 0 = until the next key.',
        group: GROUP_ENGINE,
        min: 0,
        max: 5000,
        feature: 'stickyReleaseAfter',
    },
    {
        key: 'macroDefaultWaitMs',
        label: 'Macro default wait',
        description: 'Default gap between macro steps.',
        group: GROUP_ENGINE,
        min: 0,
        max: 1000,
        feature: 'macroDefaults',
    },
    {
        key: 'macroDefaultTapMs',
        label: 'Macro default tap',
        description: 'Default tap hold-time inside a macro.',
        group: GROUP_ENGINE,
        min: 0,
        max: 1000,
        feature: 'macroDefaults',
    },
    {
        key: 'matrixPollPeriodMs',
        label: 'Matrix poll period',
        description: 'Matrix scan interval; 0 keeps the devicetree value.',
        group: GROUP_ENGINE,
        min: 0,
        max: 100,
        feature: 'matrixPollPeriod',
    },
] as const satisfies readonly TimingFieldDef[]

// Compile-time exhaustiveness: every ConfigDefaults field must appear above so a
// new schema field can never be silently un-editable. Adding a field to
// ConfigDefaults fails this line until it is listed in TIMING_FIELDS.
type CoveredKey = (typeof TIMING_FIELDS)[number]['key']
type MissingDefaultsKey = Exclude<keyof ConfigDefaults, CoveredKey>
const _allFieldsCovered: MissingDefaultsKey extends never
    ? true
    : MissingDefaultsKey = true
void _allFieldsCovered

/** Whether the connected firmware honors `field` — a field with no feature bit
 *  is always honored; otherwise the device's bitmask must advertise it. */
export function fieldSupported(
    field: TimingFieldDef,
    featureBitmask: number,
): boolean {
    if (!field.feature) return true
    return (featureBitmask & LimitsFeature[field.feature]) !== 0
}

/** The fields as contiguous `[group, fields]` sections in declared order, for a
 *  sectioned render. */
export function groupedTimingFields(): [string, TimingFieldDef[]][] {
    const out: [string, TimingFieldDef[]][] = []
    for (const f of TIMING_FIELDS) {
        const last = out[out.length - 1]
        if (last && last[0] === f.group) last[1].push(f)
        else out.push([f.group, [f]])
    }
    return out
}
