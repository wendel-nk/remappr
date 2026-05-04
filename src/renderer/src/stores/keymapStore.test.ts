// pattern-check: skip mechanical test fixture rewrite for neutral Keymap shape
import {describe, it, expect, beforeEach} from 'vitest'
import type {Keymap} from '@firmware/types'
import useKeymapStore from './keymapStore'

const makeKeymap = ( overrides: Partial<Keymap> = {} ): Keymap => ({
    layers: [],
    availableLayers: 0,
    activeLayoutId: 0,
    layouts: [],
    ...overrides,
})

describe( 'keymapStore', () => {
    beforeEach( () => {
        useKeymapStore.getState().resetKeymap()
    } )

    it( 'starts undefined', () => {
        expect( useKeymapStore.getState().keymap ).toBeUndefined()
    } )

    it( 'setKeymap accepts direct value', () => {
        const km = makeKeymap()
        useKeymapStore.getState().setKeymap( km )
        expect( useKeymapStore.getState().keymap ).toBe( km )
    } )

    it( 'setKeymap accepts updater function', () => {
        useKeymapStore.getState().setKeymap( makeKeymap() )
        useKeymapStore
            .getState()
            .setKeymap( ( prev ) =>
                prev ? {...prev, availableLayers: 5} : prev,
            )
        expect( useKeymapStore.getState().keymap?.availableLayers ).toBe( 5 )
    } )

    it( 'updater receives undefined when store is empty', () => {
        let received: Keymap | undefined = makeKeymap()
        useKeymapStore.getState().setKeymap( ( prev ) => {
            received = prev
            return prev
        } )
        expect( received ).toBeUndefined()
    } )

    it( 'resetKeymap clears state', () => {
        useKeymapStore.getState().setKeymap( makeKeymap() )
        useKeymapStore.getState().resetKeymap()
        expect( useKeymapStore.getState().keymap ).toBeUndefined()
    } )
} )
