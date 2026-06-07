// Pattern check: no GoF pattern (-) — rejected — unit tests for a zustand UI slice, plain state assertions, no abstraction.
import { describe, it, expect, beforeEach } from 'vitest'

import useRgbSheetStore from './rgbSheetStore'

const s = (): ReturnType<typeof useRgbSheetStore.getState> =>
    useRgbSheetStore.getState()

describe('rgbSheetStore', () => {
    beforeEach(() => {
        useRgbSheetStore.setState({ open: false, section: 'backlight' })
    })

    it('toggles open', () => {
        expect(s().open).toBe(false)
        s().toggle()
        expect(s().open).toBe(true)
        s().toggle()
        expect(s().open).toBe(false)
    })

    it('setOpen overrides toggle state', () => {
        s().setOpen(true)
        expect(s().open).toBe(true)
        s().setOpen(false)
        expect(s().open).toBe(false)
    })

    it('switches section', () => {
        expect(s().section).toBe('backlight')
        s().setSection('perkey')
        expect(s().section).toBe('perkey')
        s().setSection('mix')
        expect(s().section).toBe('mix')
        s().setSection('advanced')
        expect(s().section).toBe('advanced')
    })
})
