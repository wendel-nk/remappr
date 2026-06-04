// pattern-check: skip — fallback-path test, no production logic
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSecret, GITHUB_TOKEN_KEY, setSecret } from './secretStore'

// node env has no localStorage and no window.api, so the store uses its
// localStorage fallback against this in-memory shim.
const mem = new Map<string, string>()

beforeEach(() => {
    mem.clear()
    vi.stubGlobal('localStorage', {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, String(v)),
        removeItem: (k: string) => void mem.delete(k),
        clear: () => mem.clear(),
    })
})
afterEach(() => vi.unstubAllGlobals())

describe('secretStore (web fallback)', () => {
    it('round-trips a secret through localStorage', async () => {
        await setSecret(GITHUB_TOKEN_KEY, 'ghp_abc')
        expect(mem.get('remappr.secret.githubToken')).toBe('ghp_abc')
        expect(await getSecret(GITHUB_TOKEN_KEY)).toBe('ghp_abc')
    })

    it('returns empty string for an unset key', async () => {
        expect(await getSecret('nope')).toBe('')
    })

    it('clears the key when set to empty', async () => {
        await setSecret('k', 'v')
        await setSecret('k', '')
        expect(await getSecret('k')).toBe('')
        expect(mem.get('remappr.secret.k')).toBeUndefined()
    })
})
