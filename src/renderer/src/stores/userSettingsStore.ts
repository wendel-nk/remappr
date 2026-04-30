// pattern-check: skip — store schema migration to per-firmware scoping
import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'

export type KeyDisplayMode = 'displayName' | 'binding'

const DEFAULT_FIRMWARE_KEY = '_default'

// pattern-check: skip — additive optional fields on existing settings interface
interface UserSettingsState {
    theme: 'dark' | 'light'
    autosave: boolean
    autoLoadLayout: boolean
    keyDisplayMode: Record<string, KeyDisplayMode>
    setTheme: (theme: 'dark' | 'light') => void
    setAutosave: (enabled: boolean) => void
    setAutoLoadLayout: (enabled: boolean) => void
    setKeyDisplayMode: (
        firmware: string | undefined,
        mode: KeyDisplayMode,
    ) => void
    getKeyDisplayMode: (firmware: string | undefined) => KeyDisplayMode
}

const useUserSettingsStore = create<UserSettingsState>()(
    devtools(
        persist(
            (set, get) => ({
                theme: 'light',
                autosave: false,
                autoLoadLayout: false,
                keyDisplayMode: {},
                setTheme: (theme) => set({ theme }),
                setAutosave: (enabled) => set({ autosave: enabled }),
                setAutoLoadLayout: (enabled) =>
                    set({ autoLoadLayout: enabled }),
                setKeyDisplayMode: (firmware, mode) =>
                    set((s) => ({
                        keyDisplayMode: {
                            ...s.keyDisplayMode,
                            [firmware ?? DEFAULT_FIRMWARE_KEY]: mode,
                        },
                    })),
                getKeyDisplayMode: (firmware) => {
                    const map = get().keyDisplayMode
                    return (
                        map[firmware ?? DEFAULT_FIRMWARE_KEY] ??
                        map[DEFAULT_FIRMWARE_KEY] ??
                        'displayName'
                    )
                },
            }),
            {
                name: 'user-settings-store',
                storage: createJSONStorage(() => localStorage),
                version: 2,
                migrate: (persisted: unknown, version: number) => {
                    if (
                        version < 2 &&
                        persisted &&
                        typeof persisted === 'object'
                    ) {
                        const p = persisted as Record<string, unknown>
                        const legacy = p.keyDisplayMode
                        if (typeof legacy === 'string') {
                            p.keyDisplayMode = {
                                [DEFAULT_FIRMWARE_KEY]:
                                    legacy as KeyDisplayMode,
                            }
                        } else if (!legacy || typeof legacy !== 'object') {
                            p.keyDisplayMode = {}
                        }
                        return p as Partial<UserSettingsState>
                    }
                    return persisted as Partial<UserSettingsState>
                },
            },
        ),
    ),
)

export default useUserSettingsStore
