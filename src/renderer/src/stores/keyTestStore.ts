// pattern-check: skip — non-persisted zustand UI-state slice for Key Test mode, mirrors rgbSheetStore
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

/**
 * Key Test mode: flashes each key as you physically press it, and keeps a
 * persistent set of keys "seen" at least once so you can sweep a board for stuck
 * or dead switches. Lives in a store (not local state) so the Header toggle and
 * the KeyboardView that renders the stage — siblings under SidebarInset — stay
 * decoupled, exactly like rgbSheetStore. Session-only; `seen` resets on toggle.
 *
 * `seen` is keyed by physical-layout position index (the same index the live
 * flash and canvas use), NOT the heatmap's `${layout}:${pos}` key, because Key
 * Test is about the current physical layout only.
 */
interface KeyTestState {
    active: boolean
    seen: Set<number>
    setActive: (active: boolean) => void
    toggle: () => void
    markSeen: (position: number) => void
    reset: () => void
}

const useKeyTestStore = create<KeyTestState>()(
    devtools((set) => ({
        active: false,
        seen: new Set<number>(),
        setActive: (active) =>
            set((s) =>
                active === s.active
                    ? s
                    : // Entering or leaving the mode starts a fresh sweep.
                      { active, seen: new Set<number>() },
            ),
        toggle: () =>
            set((s) => ({ active: !s.active, seen: new Set<number>() })),
        markSeen: (position) =>
            set((s) =>
                s.seen.has(position)
                    ? s
                    : { seen: new Set(s.seen).add(position) },
            ),
        reset: () => set({ seen: new Set<number>() }),
    })),
)

export default useKeyTestStore
