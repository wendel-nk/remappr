// pattern-check: skip — transient zustand boolean for the load-stats modal open state
import { create } from 'zustand'

// Lifts the Typing-load modal open flag so both the header toolbar button and the
// heatmap legend's "View load stats" link can open it. Transient (not persisted).
interface LoadStatsState {
    open: boolean
    setOpen: (open: boolean) => void
}

const useLoadStatsStore = create<LoadStatsState>((set) => ({
    open: false,
    setOpen: (open) => set({ open }),
}))

export default useLoadStatsStore
