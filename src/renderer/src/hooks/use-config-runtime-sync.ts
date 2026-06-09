// Pattern check: no GoF pattern (-) — rejected — thin hook wiring a keymap-store
// subscription to a raise-into-config side effect; no abstraction.
//
// Behind-the-scenes config sync: the visual editor mutates the runtime keymap
// buffer (keymapStore); this raises each change back into the config (the source
// of truth the download modal compiles from), MERGING so config-only features
// the runtime can't model (lighting/macros/…) are preserved. Mock-only for now —
// the raise bridge is mock-specific, and only the demo seeds a config.
import { useEffect } from 'react'
import { raiseMockToConfig } from '@firmware/mock'
import useConnectionStore from '@/stores/connectionStore'
import useConfigStore from '@/stores/configStore'
import useKeymapStore from '@/stores/keymapStore'

export function useConfigRuntimeSync(): void {
    useEffect(() => {
        return useKeymapStore.subscribe((state, prev) => {
            const keymap = state.keymap
            if (!keymap || keymap === prev.keymap) return
            const { service } = useConnectionStore.getState()
            if (service?.deviceInfo.firmware !== 'mock') return
            const config = useConfigStore.getState().config
            if (!config) return
            useConfigStore
                .getState()
                .setConfig(raiseMockToConfig(keymap.layers, config))
        })
    }, [])
}
