import { useState } from 'react'
// import { Footer } from './Footer.tsx'
import { Header } from './Header.tsx'
import KeyboardView from '@/features/keymap/keyboard/KeyboardView'
import useKeymapStore from '@/stores/keymapStore'

export function Layout(): JSX.Element {
    const [selectedKeyPosition, setSelectedKeyPosition] = useState<
        number | undefined
    >(undefined)
    const { keymap } = useKeymapStore()

    return (
        <>
            <Header></Header>
            <KeyboardView
                keymap={keymap}
                selectedKeyPosition={selectedKeyPosition}
                setSelectedKeyPosition={setSelectedKeyPosition}
            />
            {/*<Footer />*/}
        </>
    )
}
