// Pattern check: no GoF pattern (-) — rejected — additive zustand store slice
// holding transient Keyboard-Builder UI state; mirrors configStore, no abstraction.
//
// The full-screen Keyboard Builder's EPHEMERAL state lives here (open flag,
// current selection, snap mode, view). The board geometry + bindings are NOT
// here — those are the validated `ConfigKeymap` in configStore (the source of
// truth). This slice only holds what the editor needs between renders and is
// reset when the builder closes. Later phases extend it (history, library, etc.).
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type SnapMode = 'grid' | 'free'

interface BuilderState {
    /** Whether the full-screen builder owns the viewport. */
    open: boolean
    /** Selected key indices (into `config.keyboard.keys`). */
    selection: Set<number>
    /** Snap-to-grid vs free-form placement (toolbar Seg toggle). */
    snapMode: SnapMode
    setOpen: (open: boolean) => void
    setSelection: (selection: Set<number>) => void
    clearSelection: () => void
    setSnapMode: (mode: SnapMode) => void
}

const useBuilderStore = create<BuilderState>()(
    devtools((set) => ({
        open: false,
        selection: new Set<number>(),
        snapMode: 'grid',
        setOpen: (open) =>
            set(open ? { open } : { open, selection: new Set<number>() }),
        setSelection: (selection) => set({ selection }),
        clearSelection: () => set({ selection: new Set<number>() }),
        setSnapMode: (snapMode) => set({ snapMode }),
    })),
)

export default useBuilderStore
