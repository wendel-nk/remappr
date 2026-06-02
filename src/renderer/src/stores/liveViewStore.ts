// Pattern check: no GoF pattern (-) — rejected — persisted zustand boolean toggle
// mirroring heatmapStore shape; lifts live-view flag so the toolbar toggle and the
// keyboard stage share one source of truth. No abstraction warranted.
import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'

/**
 * Live-view toggle: when enabled, the keyboard stage flashes simulated/real keypresses
 * and shows the pulsing LIVE indicator. Lifted out of KeyboardView local state so the
 * header toolbar's Live (zap) toggle can drive it.
 */
interface LiveViewState {
    enabled: boolean
    setEnabled: (enabled: boolean) => void
    toggle: () => void
}

const useLiveViewStore = create<LiveViewState>()(
    devtools(
        persist(
            (set) => ({
                enabled: true,
                setEnabled: (enabled) => set({ enabled }),
                toggle: () => set((s) => ({ enabled: !s.enabled })),
            }),
            {
                name: 'live-view-store',
                storage: createJSONStorage(() => localStorage),
                partialize: (s) => ({ enabled: s.enabled }),
            },
        ),
    ),
)

export default useLiveViewStore
