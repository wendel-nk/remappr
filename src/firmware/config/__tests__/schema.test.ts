import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
    parseKeymap,
    parseSurface,
    safeParseSurface,
    serializeKeymap,
    ACTION_TYPES,
} from '../index'

const seedPath = fileURLToPath(
    new URL('../../mock/seed.keymap.json', import.meta.url),
)
const seed = readFileSync(seedPath, 'utf8')

describe('config schema', () => {
    it('parses the demo seed without validation errors', () => {
        const res = safeParseSurface(seed)
        if (!res.success) {
            // Surface failures clearly so the assertion message is actionable.
            throw new Error(JSON.stringify(res.error.issues, null, 2))
        }
        expect(res.success).toBe(true)
    })

    it('normalizes shorthands to canonical form', () => {
        const km = parseKeymap(seed)
        const base = km.layers.find((l) => l.name === 'base')!
        // bare string "Q" -> key_press
        expect(base.bindings[0]).toMatchObject({ type: 'key_press' })
        // "Ctrl+C" on the lower layer -> key_press with mods
        const lower = km.layers.find((l) => l.name === 'lower')!
        const copy = lower.bindings[10]
        expect(copy).toMatchObject({ type: 'key_press', mods: ['LEFT_CTRL'] })
        // layer_tap preset -> tap_hold with a layer hold (R-thumb Backspace/Lower)
        expect(base.bindings[34]).toMatchObject({
            type: 'tap_hold',
            hold: { type: 'layer', layer: 'lower' },
            _preset: 'layer_tap',
        })
    })

    it('round-trips parse -> serialize -> parse to a stable document', () => {
        const once = parseKeymap(seed)
        const text = serializeKeymap(once)
        const twice = parseKeymap(text)
        // Strip serialize-only hints for a structural compare.
        expect(stripHints(twice)).toEqual(stripHints(once))
        // And serialize is idempotent.
        expect(serializeKeymap(twice)).toEqual(text)
    })

    it('flags an unknown keycode with a precise path', () => {
        const bad = seed.replace('"Q",', '"NOT_A_KEY",')
        const res = safeParseSurface(bad)
        expect(res.success).toBe(false)
        if (!res.success) {
            const issue = res.error.issues.find((i) =>
                i.message.includes('NOT_A_KEY'),
            )
            expect(issue).toBeDefined()
            expect(issue!.path).toEqual(['layers', 0, 'bindings', 0])
        }
    })

    it('flags a binding-count mismatch', () => {
        const surface = parseSurface(seed)
        // drop one base binding
        const broken = {
            ...surface,
            layers: surface.layers.map((l, i) =>
                i === 0 ? { ...l, bindings: l.bindings.slice(0, -1) } : l,
            ),
        }
        const res =
            // re-validate the broken object directly through the schema
            safeParseSurface(JSON.stringify(broken))
        expect(res.success).toBe(false)
    })

    it('exposes the action palette', () => {
        expect(ACTION_TYPES).toContain('key_press')
        expect(ACTION_TYPES).toContain('mod_tap')
        expect(ACTION_TYPES).toContain('layer')
    })
})

// Recursively drop `_keySrc` / `_preset` serialize hints for structural equality.
function stripHints(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(stripHints)
    if (v && typeof v === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
            if (k === '_keySrc' || k === '_preset') continue
            out[k] = stripHints(val)
        }
        return out
    }
    return v
}
