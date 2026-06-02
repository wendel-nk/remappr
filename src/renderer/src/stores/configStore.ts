// Pattern check: no GoF pattern (-) — rejected — additive zustand store slice
// holding the remappr config document; mirrors keymapStore, no abstraction.
//
// The generalized `remappr.keymap` config is the app-level SOURCE OF TRUTH for
// the keymap: the device seeds it on connect (MockKeyboardService.getConfigSource),
// the editor mutates it, and the download modal compiles it per firmware. Runtime
// KeyAction stays a separate, lossy projection — config is never round-tripped
// through it (see firmware/config/compiler.ts).
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { parseKeymap, type ConfigKeymap } from '@firmware/config'

interface ConfigState {
    /** Canonical, validated config. `null` until a device seeds it (or an import lands). */
    config: ConfigKeymap | null
    /** Raw JSON the config was last parsed from — kept for export/round-trip fidelity. */
    source: string | null
    /** Last parse failure message, or `null` when the current config is valid. */
    error: string | null
    /** Parse + validate + normalize JSON; on success replaces config + clears error.
     *  Returns whether the source was accepted (errors are surfaced, never thrown). */
    loadFromSource: (source: string) => boolean
    setConfig: (config: ConfigKeymap | null) => void
    reset: () => void
}

const useConfigStore = create<ConfigState>()(
    devtools((set) => ({
        config: null,
        source: null,
        error: null,
        loadFromSource: (source) => {
            try {
                const config = parseKeymap(source)
                set({ config, source, error: null })
                return true
            } catch (e) {
                set({ error: e instanceof Error ? e.message : String(e) })
                return false
            }
        },
        setConfig: (config) => set({ config }),
        reset: () => set({ config: null, source: null, error: null }),
    })),
)

export default useConfigStore
