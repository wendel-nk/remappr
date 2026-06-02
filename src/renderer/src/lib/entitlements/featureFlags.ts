// Pattern check: no GoF pattern (-) — rejected — static feature-flag registry +
// a build-time lookup; declarative data, no abstraction.
//
// A flag REGISTERS a feature so the UI can render its entry; whether the user
// may actually USE it is a separate entitlement check (see entitlements.ts).
// The keyboard builder is registered (its locked/upsell card shows for everyone)
// but gated behind `usePremium()`.

export const FEATURE_FLAGS = {
    /** Premium "build a keyboard from scratch" geometry editor (scaffold-only). */
    KEYBOARD_BUILDER: 'keyboard_builder',
} as const

export type FeatureFlag = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]

/**
 * Build-time kill-switch. A flag may be force-disabled via
 * `VITE_FEATURE_<FLAG>=false` (e.g. VITE_FEATURE_KEYBOARD_BUILDER=false). Absent
 * env → enabled (still entitlement-gated downstream). This is the registry seam,
 * NOT the access check.
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
    const envKey = `VITE_FEATURE_${flag.toUpperCase()}`
    const raw = (import.meta.env as Record<string, string | undefined>)[envKey]
    return raw !== 'false'
}
