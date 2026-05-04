// Pattern check: no GoF pattern (-) — rejected — import normalization + matchMedia source-of-truth fix, no abstraction
import {useEffect, useState} from 'react'

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

export function useIsMobile (): boolean {
    const [isMobile, setIsMobile] = useState<boolean>( () =>
        typeof window !== 'undefined'
            ? window.matchMedia( MOBILE_QUERY ).matches
            : false,
    )

    useEffect( (): (() => void) => {
        const mql = window.matchMedia( MOBILE_QUERY )
        const onChange = (): void => {
            setIsMobile( mql.matches )
        }
        mql.addEventListener( 'change', onChange )
        return (): void => mql.removeEventListener( 'change', onChange )
    }, [] )

    return isMobile
}
