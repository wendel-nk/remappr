// pattern-check: skip — unit test, no production logic
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    BUILDER_TOUR_STEPS,
    isLastTourStep,
    nextTourStep,
    prevTourStep,
} from './builderTourSteps'

// node env has no localStorage; userSettingsStore's persist middleware needs one
// at import time. Stub before the dynamic import below.
const mem = new Map<string, string>()
vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
} as unknown as Storage)

describe('builderTourSteps', () => {
    it('has a non-empty ordered list of steps', () => {
        expect(BUILDER_TOUR_STEPS.length).toBeGreaterThan(0)
        for (const s of BUILDER_TOUR_STEPS) {
            expect(s.title.trim()).not.toBe('')
            expect(s.body.trim()).not.toBe('')
        }
    })

    it('opens on the start chooser and ends on export', () => {
        expect(BUILDER_TOUR_STEPS[0].selector).toBe('.builder-start-modal')
        expect(BUILDER_TOUR_STEPS[0].requiresStartModal).toBe(true)
        const last = BUILDER_TOUR_STEPS[BUILDER_TOUR_STEPS.length - 1]
        expect(last.selector).toBe('[data-coach="builder-export"]')
    })

    it('only the welcome step requires the start modal', () => {
        const flagged = BUILDER_TOUR_STEPS.filter((s) => s.requiresStartModal)
        expect(flagged).toHaveLength(1)
        expect(flagged[0]).toBe(BUILDER_TOUR_STEPS[0])
    })

    it('every selector is unique and non-empty', () => {
        const anchors = BUILDER_TOUR_STEPS.map((s) => s.selector).filter(
            (s): s is string => s !== null,
        )
        for (const a of anchors) {
            expect(a.trim()).not.toBe('')
        }
        expect(new Set(anchors).size).toBe(anchors.length)
    })
})

describe('tour step navigation', () => {
    const total = BUILDER_TOUR_STEPS.length

    it('advances and clamps at the last step', () => {
        expect(nextTourStep(0, total)).toBe(1)
        expect(nextTourStep(total - 1, total)).toBe(total - 1)
    })

    it('goes back and clamps at the first step', () => {
        expect(prevTourStep(2)).toBe(1)
        expect(prevTourStep(0)).toBe(0)
    })

    it('flags only the final index as last', () => {
        expect(isLastTourStep(0, total)).toBe(false)
        expect(isLastTourStep(total - 1, total)).toBe(true)
    })

    it('walks the whole tour forward then back without overrun', () => {
        let i = 0
        while (!isLastTourStep(i, total)) i = nextTourStep(i, total)
        expect(i).toBe(total - 1)
        while (i > 0) i = prevTourStep(i)
        expect(i).toBe(0)
    })
})

describe('seenBuilderTour flag', () => {
    beforeEach(() => {
        mem.clear()
    })

    it('defaults to false and persists when set', async () => {
        const { default: useUserSettingsStore } =
            await import('@/stores/userSettingsStore')
        expect(useUserSettingsStore.getState().seenBuilderTour).toBe(false)
        useUserSettingsStore.getState().setSeenBuilderTour(true)
        expect(useUserSettingsStore.getState().seenBuilderTour).toBe(true)
        // reset for other tests sharing the module instance
        useUserSettingsStore.getState().setSeenBuilderTour(false)
    })
})
