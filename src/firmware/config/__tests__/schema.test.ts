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

describe('builder metadata fields', () => {
    const builderConfig = JSON.stringify({
        schemaVersion: 1,
        kind: 'remappr.keymap',
        meta: {
            name: 'B',
            target: 'zmk',
            vendorId: '0xFEED',
            productId: '0x0001',
        },
        keyboard: {
            id: 'b',
            name: 'B',
            keys: [
                { x: 0, y: 0, variant: 'left' },
                { x: 1, y: 0 },
            ],
            firmware: ['qmk', 'via', 'vial', 'zmk'],
            lighting: {
                underglow: { effect: 'solid', hue: 200, brightness: 80 },
                backlight: { brightness: 50, breathing: true },
            },
            layouts: [{ id: 'left', name: 'Left' }],
            split: true,
        },
        layers: [{ name: 'base', bindings: ['Q', 'W'] }],
    })

    it('parses + carries the builder fields into the canonical doc', () => {
        const km = parseKeymap(builderConfig)
        expect(km.meta.vendorId).toBe('0xFEED')
        expect(km.meta.productId).toBe('0x0001')
        expect(km.keyboard.firmware).toEqual(['qmk', 'via', 'vial', 'zmk'])
        expect(km.keyboard.lighting?.underglow?.hue).toBe(200)
        expect(km.keyboard.lighting?.backlight?.breathing).toBe(true)
        expect(km.keyboard.keys[0].variant).toBe('left')
        expect(km.keyboard.keys[1].variant).toBeUndefined()
        expect(km.keyboard.layouts).toEqual([{ id: 'left', name: 'Left' }])
        expect(km.keyboard.split).toBe(true)
    })

    it('round-trips the builder fields losslessly', () => {
        const once = parseKeymap(builderConfig)
        const text = serializeKeymap(once)
        const twice = parseKeymap(text)
        expect(stripHints(twice)).toEqual(stripHints(once))
        expect(serializeKeymap(twice)).toEqual(text)
    })

    it('omits the new fields when absent (old configs stay clean)', () => {
        const km = parseKeymap(serializeKeymap(parseKeymap(seed)))
        expect(km.meta.vendorId).toBeUndefined()
        expect(km.meta.productId).toBeUndefined()
        expect(km.keyboard.firmware).toBeUndefined()
        expect(km.keyboard.lighting).toBeUndefined()
        expect(km.keyboard.layouts).toBeUndefined()
        expect(km.keyboard.split).toBeUndefined()
        expect(km.keyboard.keys.some((k) => k.variant !== undefined)).toBe(
            false,
        )
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
