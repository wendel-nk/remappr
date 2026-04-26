import { useEffect } from 'react'
import {
    findKeyPositionForDomKey,
    type KeypressDetectionConfig,
} from '@/lib/keypress/keypressDetector'

interface KeypressHandlers {
    onPressed: (keyPosition: number) => void
    onReleased: (keyPosition: number) => void
}

export function useKeypressDetection(
    config: KeypressDetectionConfig | null,
    { onPressed, onReleased }: KeypressHandlers,
): void {
    useEffect(() => {
        if (!config) return

        const handleKeyDown = (event: KeyboardEvent): void => {
            if (
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement
            ) {
                return
            }
            const keyPosition = findKeyPositionForDomKey(event.code, config)
            if (keyPosition !== null) onPressed(keyPosition)
        }

        const handleKeyUp = (event: KeyboardEvent): void => {
            const keyPosition = findKeyPositionForDomKey(event.code, config)
            if (keyPosition !== null) onReleased(keyPosition)
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)

        return (): void => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [config, onPressed, onReleased])
}
