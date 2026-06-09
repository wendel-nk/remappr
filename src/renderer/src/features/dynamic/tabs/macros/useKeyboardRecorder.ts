// pattern-check: skip — single-effect hook wrapping a window keydown listener
import { useEffect } from 'react'

import type { MacroAction } from '@firmware'
import { DOM_KEY_TO_HID } from '@/lib/keypress/domKeyToHidMap'

type SetActions = React.Dispatch<React.SetStateAction<MacroAction[] | null>>

/**
 * Record mode: while on, OS keydowns append `tap` actions (reusing the same
 * DOM-code → HID-usage map the live-view detector uses). preventDefault stops
 * the captured keys from typing elsewhere. Editing-only.
 */
export function useKeyboardRecorder(
    recording: boolean,
    editable: boolean,
    opened: boolean,
    setActions: SetActions,
): void {
    useEffect(() => {
        if (!recording || !editable || !opened) return
        const onKeyDown = (e: KeyboardEvent): void => {
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
            )
                return
            const keycode = DOM_KEY_TO_HID[e.code]
            if (keycode === undefined) return
            e.preventDefault()
            setActions((prev) => [...(prev ?? []), { kind: 'tap', keycode }])
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [recording, editable, opened, setActions])
}
