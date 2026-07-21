import { describe, expect, it } from 'vitest'

import type { RgbApi } from '@firmware/service'
import { sectionsForRgb } from './rgbSheetSections'

const ids = (rgb: RgbApi | undefined): string[] =>
    sectionsForRgb(rgb).map((section) => section.id)

describe('sectionsForRgb', () => {
    it('routes capability-driven ZMK lighting to underglow only', () => {
        const rgb: RgbApi = {
            effectCatalog: {
                kind: 'zmk_underglow',
                effects: ['Solid'],
                hasColor: true,
                hasSpeed: true,
            },
            getEffect: async () => ({
                mode: 0,
                brightness: 255,
                speed: 0,
                color: { h: 0, s: 0, v: 255 },
            }),
            setEffect: async () => undefined,
            save: async () => undefined,
        }

        expect(ids(rgb)).toEqual(['underglow'])
    })

    it('does not invent device features for unsupported firmware', () => {
        expect(ids(undefined)).toEqual(['backlight'])
    })

    it('shows only optional sections backed by facade methods', () => {
        const rgb: RgbApi = {
            effectCatalog: {
                kind: 'rgb_matrix',
                effects: ['Solid'],
                hasColor: true,
                hasSpeed: true,
            },
            getEffect: async () => ({
                mode: 0,
                brightness: 255,
                speed: 0,
                color: { h: 0, s: 0, v: 255 },
            }),
            setEffect: async () => undefined,
            getIndicators: async () => {
                throw new Error('not called')
            },
            setIndicators: async () => undefined,
            save: async () => undefined,
        }

        expect(ids(rgb)).toEqual(['backlight', 'indicator'])
    })
})
