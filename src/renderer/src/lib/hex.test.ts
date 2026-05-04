import {describe, it, expect} from 'vitest'
import {hex16, parseHex16} from './hex'

describe( 'hex16', () => {
    it( 'formats a value as a 4-digit hex literal', () => {
        expect( hex16( 0 ) ).toBe( '0x0000' )
        expect( hex16( 0xff ) ).toBe( '0x00ff' )
        expect( hex16( 0xffff ) ).toBe( '0xffff' )
    } )

    it( 'masks values larger than 16 bits', () => {
        expect( hex16( 0x1ffff ) ).toBe( '0xffff' )
    } )
} )

describe( 'parseHex16', () => {
    it( 'parses lowercase 0x prefix', () => {
        expect( parseHex16( '0xff' ) ).toBe( 0xff )
        expect( parseHex16( '0xffff' ) ).toBe( 0xffff )
    } )

    it( 'parses uppercase 0X prefix', () => {
        expect( parseHex16( '0XFF' ) ).toBe( 0xff )
        expect( parseHex16( '0X00AB' ) ).toBe( 0xab )
    } )

    it( 'parses decimal when no 0x prefix', () => {
        expect( parseHex16( '255' ) ).toBe( 255 )
        expect( parseHex16( '0' ) ).toBe( 0 )
    } )

    it( 'trims surrounding whitespace', () => {
        expect( parseHex16( '  0xff  ' ) ).toBe( 0xff )
        expect( parseHex16( '\t10\n' ) ).toBe( 10 )
    } )

    it( 'masks values larger than 16 bits', () => {
        expect( parseHex16( '0x1ffff' ) ).toBe( 0xffff )
    } )

    it( 'returns 0 for unparseable input', () => {
        expect( parseHex16( 'garbage' ) ).toBe( 0 )
        expect( parseHex16( '' ) ).toBe( 0 )
        expect( parseHex16( '0xZZ' ) ).toBe( 0 )
    } )
} )
