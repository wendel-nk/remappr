import { useCallback, useState } from 'react'
import KeyboardView from '@/features/keymap/keyboard/KeyboardView'
import { BindingEditor } from './BindingEditor'
import useKeymapStore from '@/stores/keymapStore'

export type EncoderSelection = { slot: number; dir: 'cw' | 'ccw' }

export function KeymapEditor(): JSX.Element {
    const [selectedKeyPosition, setSelectedKeyPositionRaw] = useState<
        number | undefined
    >(undefined)
    const [selectedEncoder, setSelectedEncoderRaw] = useState<
        EncoderSelection | undefined
    >(undefined)
    const [multiSelection, setMultiSelection] = useState<Set<number>>(
        () => new Set(),
    )

    const { keymap, setKeymap } = useKeymapStore()

    const setSelectedKeyPosition = useCallback(
        (p: number | undefined): void => {
            setSelectedKeyPositionRaw(p)
            if (p !== undefined) setSelectedEncoderRaw(undefined)
        },
        [],
    )
    const setSelectedEncoder = useCallback(
        (e: EncoderSelection | undefined): void => {
            setSelectedEncoderRaw(e)
            if (e) setSelectedKeyPositionRaw(undefined)
        },
        [],
    )

    return (
        <div className="flex flex-col flex-1">
            <KeyboardView
                keymap={keymap}
                selectedKeyPosition={selectedKeyPosition}
                setSelectedKeyPosition={setSelectedKeyPosition}
                selectedEncoder={selectedEncoder}
                setSelectedEncoder={setSelectedEncoder}
                multiSelection={multiSelection}
                setMultiSelection={setMultiSelection}
            />
            <BindingEditor
                keymap={keymap}
                setKeymap={setKeymap}
                selectedKeyPosition={selectedKeyPosition}
                setSelectedKeyPosition={setSelectedKeyPosition}
                selectedEncoder={selectedEncoder}
                setSelectedEncoder={setSelectedEncoder}
            />
        </div>
    )
}
