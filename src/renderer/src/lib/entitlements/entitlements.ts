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

/** Persist (or clear, when `null`) the local license key. */
export function setLicenseKey(key: string | null): void {
    try {
        if (key) localStorage.setItem(LICENSE_STORAGE_KEY, key)
        else localStorage.removeItem(LICENSE_STORAGE_KEY)
    } catch {
        /* storage unavailable — non-fatal, stays locked */
    }
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
