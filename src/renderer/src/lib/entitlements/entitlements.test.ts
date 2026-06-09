// pattern-check: skip — unit test, no production logic
import { describe, it, expect, beforeEach } from 'vitest'
import {
    hasPremium,
    getLicenseKey,
    setLicenseKey,
    licenseKeyHash,
    verifyLicense,
} from './index'

// Vitest runs in the `node` environment (no DOM), so provide a minimal in-memory
// localStorage for the storage-backed key path.
function installLocalStorage(): void {
    const store = new Map<string, string>()
    ;(globalThis as { localStorage?: Storage }).localStorage = {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => void store.set(k, String(v)),
        removeItem: (k) => void store.delete(k),
        clear: () => store.clear(),
        key: (i) => [...store.keys()][i] ?? null,
        get length() {
            return store.size
        },
    } as Storage
}

describe('entitlements', () => {
    beforeEach(() => {
        installLocalStorage()
    })

    it('licenseKeyHash is deterministic 8-hex', () => {
        const a = licenseKeyHash('hello')
        expect(a).toMatch(/^[0-9a-f]{8}$/)
        expect(licenseKeyHash('hello')).toBe(a)
        expect(licenseKeyHash('hellp')).not.toBe(a)
    })

    it('defaults to no premium (no key set)', () => {
        expect(getLicenseKey()).toBeNull()
        expect(hasPremium()).toBe(false)
    })

    it('verifyLicense rejects null/empty/wrong keys', () => {
        expect(verifyLicense(null)).toBe(false)
        expect(verifyLicense('')).toBe(false)
        expect(verifyLicense('definitely-not-the-key')).toBe(false)
    })

    it('setLicenseKey persists + clears the local key', () => {
        setLicenseKey('my-key')
        expect(getLicenseKey()).toBe('my-key')
        setLicenseKey(null)
        expect(getLicenseKey()).toBeNull()
    })
})
