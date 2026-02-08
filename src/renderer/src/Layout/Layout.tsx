import { useState } from 'react'
import { Footer } from './Footer.tsx'
import { Header } from './Header.tsx'
import Keyboard from '../components/keyboard/Keyboard.tsx'
import useKeymapStore from '@/stores/KeymapStore.ts'

export function Layout(): JSX.Element {
    const [selectedKeyPosition, setSelectedKeyPosition] = useState<
        number | undefined
    >(undefined)
    const { keymap } = useKeymapStore()

    return (
        <>
            <Header></Header>
            <Keyboard
                keymap={keymap}
                selectedKeyPosition={selectedKeyPosition}
                setSelectedKeyPosition={setSelectedKeyPosition}
            />
            <Footer />
        </>
    )
}
