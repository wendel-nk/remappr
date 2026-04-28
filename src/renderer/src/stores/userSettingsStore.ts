import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'

// Define the store interface
export type KeyDisplayMode = 'displayName' | 'binding'

interface UserSettingsState {
    theme: 'dark' | 'light'
    autosave: boolean
    keyDisplayMode: KeyDisplayMode
    setTheme: (theme: 'dark' | 'light') => void
    setAutosave: (enabled: boolean) => void
    setKeyDisplayMode: (mode: KeyDisplayMode) => void
}

// Create Zustand store with persistence
const useUserSettingsStore = create<UserSettingsState>()(
    devtools(
        persist(
            (set) => ({
                theme: 'light',
                autosave: false,
                keyDisplayMode: 'displayName',
                setTheme: (theme) => set({ theme }),
                setAutosave: (enabled) => set({ autosave: enabled }),
                setKeyDisplayMode: (mode) => set({ keyDisplayMode: mode }),
            }),
            {
                name: 'user-settings-store', // Storage key
                storage: createJSONStorage(() => localStorage), // Persist in localStorage
            },
        ),
    ),
)

export default useUserSettingsStore
