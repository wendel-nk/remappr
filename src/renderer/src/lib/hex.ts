// pattern-check: skip — two pure utility functions, no class/interface/abstraction
export const hex16 = ( v: number ): string =>
    '0x' + (v & 0xffff).toString( 16 ).padStart( 4, '0' )

export const parseHex16 = ( s: string ): number => {
    const trimmed = s.trim()
    const isHex = /^0x/i.test( trimmed )
    const v = isHex ? parseInt( trimmed.slice( 2 ), 16 ) : parseInt( trimmed, 10 )
    return Number.isFinite( v ) ? v & 0xffff : 0
}
