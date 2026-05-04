import 'react'
import type * as React from 'react'

// Needed for setting CSS *variables* to `style` properties in TSX.
declare module 'react' {
    interface CSSProperties {
        [key: `--${string}`]: string | number
    }
}

declare global {
    namespace JSX {
        type Element = React.JSX.Element
    }
}

export {}
