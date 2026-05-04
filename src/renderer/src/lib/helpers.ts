export type LayoutZoom = number | 'auto'

export function deserializeLayoutZoom ( value: string ): LayoutZoom {
    if ( value === 'auto' ) {
        return 'auto'
    }
    const n = parseFloat( value )
    return Number.isFinite( n ) && n > 0 ? n : 'auto'
}
