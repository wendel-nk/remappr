// Pattern check: no GoF pattern (-) — rejected — vitest unit tests for MockCodec HID-only encode/decode; assertions only.
import {describe, expect, it} from 'vitest'

import {mockCodec} from './codec'

describe( 'MockCodec', () => {
    it( 'encodes HID letter as packed (7<<16)|0x04', () => {
        expect( mockCodec.encode( 'key.keyboard_a' )?.value ).toBe( (7 << 16) | 0x04 )
    } )

    it( 'round-trips key.keyboard_a', () => {
        const enc = mockCodec.encode( 'key.keyboard_a' )
        expect( mockCodec.decode( enc!.value )?.canonicalId ).toBe( 'key.keyboard_a' )
    } )

    it( 'returns null for firmware-only canonical ids', () => {
        expect( mockCodec.encode( 'wireless.profile.1' ) ).toBeNull()
        expect( mockCodec.encode( 'rgb.toggle' ) ).toBeNull()
        expect( mockCodec.encode( 'mouse.cursor.up' ) ).toBeNull()
    } )
} )
