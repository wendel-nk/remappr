import { useState } from 'react'
import KeyboardView from '@/features/keymap/keyboard/KeyboardView'
import { BindingEditor } from './BindingEditor'
import useKeymapStore from '@/stores/keymapStore'

export function KeymapEditor(): JSX.Element {
    const [selectedKeyPosition, setSelectedKeyPosition] = useState<
        number | undefined
    >(undefined)

    const { keymap, setKeymap } = useKeymapStore()

    return (
        <div className="flex flex-col flex-1">
            <KeyboardView
                keymap={keymap}
                selectedKeyPosition={selectedKeyPosition}
                setSelectedKeyPosition={setSelectedKeyPosition}
            />
            <BindingEditor
                keymap={keymap}
                setKeymap={setKeymap}
                selectedKeyPosition={selectedKeyPosition}
                setSelectedKeyPosition={setSelectedKeyPosition}
            />
        </div>
    )
}
