import { useState } from 'react'
import Keyboard from '@/features/keymap/keyboard/Keyboard.tsx'
import { KeyEditor } from './KeyEditor.tsx'
import useKeymapStore from '@/features/keymap/keymapStore.ts'

/**
 * KeyboardEditor Component
 *
 * A parent component that manages the shared state between Keyboard and KeyEditor components.
 * Handles the selection state and coordinates between the keyboard display and key editing interface.
 */
export function KeyboardEditor(): JSX.Element {
    const [selectedKeyPosition, setSelectedKeyPosition] = useState<
        number | undefined
    >(undefined)

    // Use centralized keymap store
    const { keymap, setKeymap } = useKeymapStore()

    return (
        <div className="flex flex-col flex-1">
            <Keyboard
                keymap={keymap}
                selectedKeyPosition={selectedKeyPosition}
                setSelectedKeyPosition={setSelectedKeyPosition}
            />
            <KeyEditor
                keymap={keymap}
                setKeymap={setKeymap}
                selectedKeyPosition={selectedKeyPosition}
                setSelectedKeyPosition={setSelectedKeyPosition}
            />
        </div>
    )
}
