// Pattern check: no GoF pattern (-) — rejected — unit tests over the pure
// firmware-gated ActionType[] builder; assertions on data, no abstraction.
import { describe, expect, it } from 'vitest'
import type { CanonMacro, CanonTapDance } from '@firmware/config'
import { builderActionTypes, ENUM_ACTIONS } from './builderActionTypes'

const ids = (targets: string[] | undefined, m = [], td = []): string[] =>
    builderActionTypes(targets, m as CanonMacro[], td as CanonTapDance[]).map(
        (t) => t.id,
    )

describe('builderActionTypes — firmware gating', () => {
    it('defaults to QMK when no targets', () => {
        expect(ids(undefined)).toContain('key_press')
    })

    it('ZMK exposes output/ext_power/layer_sticky, not tap_dance/grave_escape', () => {
        const z = ids(['zmk'])
        expect(z).toEqual(
            expect.arrayContaining([
                'output',
                'ext_power',
                'layer_sticky',
                'studio_unlock',
                'soft_off',
            ]),
        )
        expect(z).not.toContain('tap_dance')
        expect(z).not.toContain('grave_escape')
    })

    it('QMK exposes tap_dance/grave_escape, not output/ext_power', () => {
        const q = ids(['qmk'])
        expect(q).toContain('grave_escape')
        expect(q).not.toContain('output')
        expect(q).not.toContain('ext_power')
    })

    it('unions multiple targets, deduped, in canonical order', () => {
        const u = ids(['zmk', 'qmk'])
        expect(u).toContain('output') // zmk-only
        expect(u).toContain('grave_escape') // qmk-only
        expect(u[0]).toBe('key_press')
        expect(new Set(u).size).toBe(u.length)
    })

    it('drops macro / tap_dance when the config defines none', () => {
        expect(ids(['qmk'])).not.toContain('tap_dance')
        expect(ids(['zmk'])).not.toContain('macro')
    })

    it('includes macro / tap_dance with refs, slot values match', () => {
        const macros = [{ id: 'm0', steps: [] }] as unknown as CanonMacro[]
        const tds = [{ id: 'td0', taps: [] }] as unknown as CanonTapDance[]
        const types = builderActionTypes(['qmk'], macros, tds)
        const macro = types.find((t) => t.id === 'macro')
        expect(macro?.slots[0].values?.[0]).toEqual({ value: 0, label: 'm0' })
        const td = types.find((t) => t.id === 'tap_dance')
        expect(td?.slots[0].values?.[0]).toEqual({ value: 0, label: 'td0' })
    })
})

describe('builderActionTypes — enum slots', () => {
    it('output slot mirrors ENUM_ACTIONS values', () => {
        const out = builderActionTypes(['zmk']).find((t) => t.id === 'output')
        expect(out?.slots[0].kind).toBe('enum')
        expect(out?.slots[0].values?.length).toBe(ENUM_ACTIONS.output.length)
    })

    it('enum values are contiguous 0..n-1', () => {
        for (const defs of Object.values(ENUM_ACTIONS)) {
            defs.forEach((d, i) => expect(d.value).toBe(i))
        }
    })
})
