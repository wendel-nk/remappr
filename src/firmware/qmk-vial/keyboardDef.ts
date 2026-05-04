// Pattern check: no GoF pattern (-) — rejected — Vial wire fetch + LZMA decode glue around shared KLE parser.
// Vial firmware ships a per-board JSON definition compressed with raw LZMA1.
// Wire flow: GET_SIZE → GET_DEFINITION (block index) → concat → lzma1.decompress → JSON.

import {decompress as lzmaDecompress} from 'lzma1'

import {ProtocolError} from '@firmware/errors'
import {
    parseKeyboardDef,
    validateDef,
    type ParsedKeyboardDef,
    type RawKeyboardDef,
} from '@firmware/kle/parser'
import type {HidClient} from '@firmware/qmk/hidClient'
import {VIA_PAYLOAD_SIZE} from '@firmware/qmk/protocol'

import {getDefinitionCmd, getSizeCmd, parseSize} from './protocol'

export type {
    ParsedKeyboardDef,
    RawKeyboardDef,
    VialCustomKeycode,
} from '@firmware/kle/parser'
export {parseKeyboardDef, validateDef} from '@firmware/kle/parser'

export async function fetchKeyboardDefBytes (
    client: HidClient,
): Promise<Uint8Array> {
    const sizeResp = await client.send( getSizeCmd() )
    const size = parseSize( sizeResp )
    if ( size === 0 || size > 0x100000 ) {
        throw new ProtocolError( `Vial def: implausible size ${size}` )
    }
    const out = new Uint8Array( size )
    let written = 0
    let block = 0
    while ( written < size ) {
        const resp = await client.send( getDefinitionCmd( block ) )
        const remaining = size - written
        const take = Math.min( remaining, VIA_PAYLOAD_SIZE )
        out.set( resp.subarray( 0, take ), written )
        written += take
        block += 1
    }
    return out
}

export function decompressDef ( bytes: Uint8Array ): RawKeyboardDef {
    const decoded = lzmaDecompress( bytes )
    const u8 =
        decoded instanceof Uint8Array
            ? decoded
            : new Uint8Array( (decoded as ArrayLike<number>).length )
    if ( !(decoded instanceof Uint8Array) ) {
        for ( let i = 0; i < u8.length; i++ ) {
            u8[i] = (decoded as ArrayLike<number>)[i] & 0xff
        }
    }
    const text = new TextDecoder( 'utf-8' ).decode( u8 )
    let json: unknown
    try {
        json = JSON.parse( text )
    } catch ( err ) {
        throw new ProtocolError(
            `Vial def: JSON parse failed: ${(err as Error).message}`,
        )
    }
    return validateDef( json )
}

export async function fetchAndParseKeyboardDef (
    client: HidClient,
): Promise<ParsedKeyboardDef> {
    const bytes = await fetchKeyboardDefBytes( client )
    const def = decompressDef( bytes )
    return parseKeyboardDef( def )
}
