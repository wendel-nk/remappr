// pattern-check: skip type-rewrite — Keymap from ZMK shape to neutral @firmware/types
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Keymap } from '@firmware/types'

// Define the store interface
interface KeymapState {
    keymap: Keymap | undefined
    setKeymap: (
        keymap:
            | Keymap
            | undefined
            | ((prev: Keymap | undefined) => Keymap | undefined),
    ) => void
    resetKeymap: () => void
}

// Create Zustand store with devtools
const useKeymapStore = create<KeymapState>()(
    devtools((set) => ({
        keymap: undefined,
        setKeymap: (keymapOrUpdater) =>
            set((state) => {
                if (typeof keymapOrUpdater === 'function') {
                    return { keymap: keymapOrUpdater(state.keymap) }
                }
                return { keymap: keymapOrUpdater }
            }),
        resetKeymap: () => set({ keymap: undefined }),
    })),
)

export default useKeymapStore
