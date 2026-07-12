// pattern-check: skip — unit test for the pure timing-field descriptors/helpers
import { describe, expect, it } from 'vitest'

import { LimitsFeature } from '@firmware/remappr/protocol'

import {
    TIMING_FIELDS,
    type TimingFieldDef,
    fieldSupported,
    groupedTimingFields,
} from './timingFields'

// The exported table is a readonly literal tuple (for the compile-time
// exhaustiveness guard); widen to the descriptor type so `.feature` (optional on
// some members) is uniformly accessible here.
const FIELDS: readonly TimingFieldDef[] = TIMING_FIELDS

describe('timing field descriptors', () => {
    it('has unique keys and non-inverted ranges', () => {
        const keys = FIELDS.map((f) => f.key)
        expect(new Set(keys).size).toBe(keys.length)
        for (const f of FIELDS) expect(f.max).toBeGreaterThanOrEqual(f.min)
    })

    it('gates exactly the five §7.4.1 tail fields on a feature bit', () => {
        const gated = FIELDS.filter((f) => f.feature)
            .map((f) => f.key)
            .sort()
        expect(gated).toEqual(
            [
                'capsWordIdleMs',
                'macroDefaultTapMs',
                'macroDefaultWaitMs',
                'matrixPollPeriodMs',
                'stickyReleaseDefaultMs',
            ].sort(),
        )
        for (const f of FIELDS)
            if (f.feature) expect(LimitsFeature[f.feature]).toBeGreaterThan(0)
    })

    it('fieldSupported: unfeatured always honored; featured follows the bitmask', () => {
        const caps = FIELDS.find((f) => f.key === 'capsWordIdleMs')!
        const term = FIELDS.find((f) => f.key === 'tappingTermMs')!
        expect(fieldSupported(term, 0)).toBe(true)
        expect(fieldSupported(caps, 0)).toBe(false)
        expect(fieldSupported(caps, LimitsFeature.capsWordIdle)).toBe(true)
        expect(fieldSupported(caps, LimitsFeature.macroDefaults)).toBe(false)
    })

    it('groups fields contiguously without splitting or dropping any', () => {
        const groups = groupedTimingFields()
        const names = groups.map(([g]) => g)
        // Each group name appears once → groups are contiguous in declared order.
        expect(new Set(names).size).toBe(names.length)
        expect(groups.flatMap(([, fs]) => fs)).toHaveLength(
            TIMING_FIELDS.length,
        )
    })
})
