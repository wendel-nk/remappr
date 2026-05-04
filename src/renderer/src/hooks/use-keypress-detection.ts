// Pattern check: no GoF pattern (-) — rejected — ref-latest fix to stop listener re-attach, no abstraction needed
import {useEffect, useRef} from 'react'
import {
    findKeyPositionForDomKey,
    type KeypressDetectionConfig,
} from '@/lib/keypress/keypressDetector'

interface KeypressHandlers {
    onPressed: ( keyPosition: number ) => void
    onReleased: ( keyPosition: number ) => void
}

export function useKeypressDetection (
    config: KeypressDetectionConfig | null,
    {onPressed, onReleased}: KeypressHandlers,
): void {
    const onPressedRef = useRef( onPressed )
    const onReleasedRef = useRef( onReleased )

    useEffect( () => {
        onPressedRef.current = onPressed
        onReleasedRef.current = onReleased
    }, [onPressed, onReleased] )

    useEffect( () => {
        if ( !config ) return

        const handleKeyDown = ( event: KeyboardEvent ): void => {
            if (
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement
            ) {
                return
            }
            const keyPosition = findKeyPositionForDomKey( event.code, config )
            if ( keyPosition !== null ) onPressedRef.current( keyPosition )
        }

        const handleKeyUp = ( event: KeyboardEvent ): void => {
            const keyPosition = findKeyPositionForDomKey( event.code, config )
            if ( keyPosition !== null ) onReleasedRef.current( keyPosition )
        }

        window.addEventListener( 'keydown', handleKeyDown )
        window.addEventListener( 'keyup', handleKeyUp )

        return (): void => {
            window.removeEventListener( 'keydown', handleKeyDown )
            window.removeEventListener( 'keyup', handleKeyUp )
        }
    }, [config] )
}
