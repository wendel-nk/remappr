// pattern-check: skip — persisted zustand counter store mirroring layerSelectionStore shape
// Pattern check: no GoF pattern (-) — rejected — single-slot press-count accumulator + on/off
// toggle, persisted to localStorage; mirrors existing zustand store shape, no abstraction.
import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'

/**
 * Per-position keyboard press counts, accumulated from live keypress detection and
 * tinted onto the caps when the heatmap overlay is enabled. Counts are keyed by
 * `${physicalLayoutIndex}:${position}` so switching physical layouts keeps separate maps.
 */
interface HeatmapState {
    enabled: boolean
    counts: Record<string, number>
    setEnabled: (enabled: boolean) => void
    toggle: () => void
    increment: (key: string) => void
    reset: () => void
}

const useHeatmapStore = create<HeatmapState>()(
    devtools(
        persist(
            (set) => ({
                enabled: false,
                counts: {},
                setEnabled: (enabled) => set({ enabled }),
                toggle: () => set((s) => ({ enabled: !s.enabled })),
                increment: (key) =>
                    set((s) => ({
                        counts: {
                            ...s.counts,
                            [key]: (s.counts[key] ?? 0) + 1,
                        },
                    })),
                reset: () => set({ counts: {} }),
            }),
            {
                name: 'heatmap-store',
                storage: createJSONStorage(() => localStorage),
                // Persist the accumulated counts + toggle; setters are recreated on load.
                partialize: (s) => ({ enabled: s.enabled, counts: s.counts }),
            },
        ),
    ),
)

export default useHeatmapStore
