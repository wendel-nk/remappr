// Pattern check: no GoF pattern (-) — rejected — license-key gate is a handful of
// plain pure functions over an env var / localStorage; no abstraction.
//
// Owner-only entitlement stub. Open-source ⇒ NO plaintext secret in the tree:
// the repo ships only EXPECTED_LICENSE_HASH (an obfuscated, non-cryptographic
// fingerprint). The owner generates it once with `licenseKeyHash('<their key>')`,
// pastes it below, and sets VITE_REMAPPR_LICENSE_KEY locally to unlock. This is a
// SEAM — swap the whole stub for real public-key signature verification (and a
// billing/auth backend) later without touching call sites.

const LICENSE_STORAGE_KEY = 'remappr.licenseKey'

/** Dispatched on the window when the local license key changes, so hooks in the
 *  SAME tab re-evaluate (the `storage` event only fires in OTHER tabs). */
export const LICENSE_CHANGE_EVENT = 'remappr:license-change'

// Pattern check: no GoF pattern (-) — rejected — string-literal stage flag plus
// pure predicates over the existing entitlement stub; no abstraction warranted.

/** Lifecycle stage of the builder. `alpha`/`beta` are FREE for everyone; `ga`
 *  (general availability) is the paid premium feature. */
export type BuilderStage = 'alpha' | 'beta' | 'ga'

/**
 * Current builder stage. While `alpha` or `beta`, the builder is FREE for
 * everyone — no license key, no account. It's still a *premium feature*: the UI
 * says so and explains that monetization (account sign-in) lands at `ga`, once
 * it's fully working and compatible with every supported firmware. Bump to `ga`
 * when billing ships; access then falls back to `hasPremium()` / the license gate.
 */
const BUILDER_STAGE: BuilderStage = 'alpha'

/** The builder's current lifecycle stage (drives badge label + "free" copy). */
export function getBuilderStage(): BuilderStage {
    return BUILDER_STAGE
}

/** Whether the builder is in a free pre-release stage (alpha or beta). */
export function isBuilderFree(): boolean {
    return BUILDER_STAGE === 'alpha' || BUILDER_STAGE === 'beta'
}

/**
 * The gate the builder entry reads. During alpha/beta everyone gets in; at `ga`
 * it collapses to the premium entitlement. Keeping this separate from
 * `hasPremium()` means bumping `BUILDER_STAGE` is the only change to start charging.
 */
export function hasBuilderAccess(): boolean {
    return isBuilderFree() || hasPremium()
}

/**
 * Fingerprint of the accepted license key. Default `'00000000'` matches no real
 * key, so premium is off for everyone. To unlock locally: run
 * `licenseKeyHash('YOUR-KEY')` in a console, paste the result here, then set
 * `VITE_REMAPPR_LICENSE_KEY=YOUR-KEY` (env) or call `setLicenseKey('YOUR-KEY')`.
 */
const EXPECTED_LICENSE_HASH = '00000000'

/**
 * FNV-1a 32-bit hex digest. Deterministic and dependency-free — enough to avoid
 * shipping the key in plaintext, but NOT cryptographic. Real signature checks
 * replace this when billing lands.
 */
export function licenseKeyHash(key: string): string {
    let h = 0x811c9dc5
    for (let i = 0; i < key.length; i++) {
        h ^= key.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
    }
    return (h >>> 0).toString(16).padStart(8, '0')
}

/** Build-time env wins; else a locally-stored key. `null` when neither is set. */
export function getLicenseKey(): string | null {
    const env = (import.meta.env as Record<string, string | undefined>)
        .VITE_REMAPPR_LICENSE_KEY
    if (typeof env === 'string' && env.length > 0) return env
    try {
        return localStorage.getItem(LICENSE_STORAGE_KEY)
    } catch {
        return null
    }
}

// pattern-check: skip — add same-tab change notification to existing setter
/** Persist (or clear, when `null`) the local license key. */
export function setLicenseKey(key: string | null): void {
    try {
        if (key) localStorage.setItem(LICENSE_STORAGE_KEY, key)
        else localStorage.removeItem(LICENSE_STORAGE_KEY)
    } catch {
        /* storage unavailable — non-fatal, stays locked */
    }
    // localStorage's `storage` event only fires in OTHER tabs, so the tab that
    // called this would not re-evaluate until remount. Notify same-tab listeners.
    if (typeof window !== 'undefined')
        window.dispatchEvent(new Event(LICENSE_CHANGE_EVENT))
}

/** Whether a key matches the accepted fingerprint. */
export function verifyLicense(key: string | null): boolean {
    if (!key) return false
    return licenseKeyHash(key) === EXPECTED_LICENSE_HASH
}

// Pattern check: no GoF pattern (-) — rejected — one dev-bypass conditional added
// to the existing entitlement gate; no new symbol, no abstraction.
/** The single entitlement gate the app reads. Defaults to `false` for everyone.
 *  Dev bypass: a local dev build (not test, not production) unlocks premium so
 *  the owner can work on gated features without a key; shipped builds stay gated. */
export function hasPremium(): boolean {
    if (import.meta.env.DEV && import.meta.env.MODE !== 'test') return true
    return verifyLicense(getLicenseKey())
}
