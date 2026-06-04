// Pattern check: no GoF pattern (-) — rejected — additive zustand store slice
// holding transient Keyboard-Builder UI state + a plain undo/redo snapshot stack;
// not the Memento pattern (no caretaker/originator split — just ConfigKeymap[]).
//
// The full-screen Keyboard Builder's EPHEMERAL state: open flag, selection,
// snap mode, pan/zoom view, and a full-config undo/redo history. The board
// geometry + bindings themselves live in configStore (the source of truth);
// history here snapshots that store and restores it. Live-drag gestures are
// coalesced into ONE history entry via `arm()` (mousedown) → `liveCommit()`
// (first move pushes the armed snapshot, later moves don't) → `endGesture()`.
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ConfigKeymap } from '@firmware/config'
import useConfigStore from '@/stores/configStore'

export type SnapMode = 'grid' | 'free'

/** Pan/zoom view, ported from the prototype: zoom is relative to the fitted
 *  board (1 = fit), pan is a viewport-px offset applied before scale. */
export interface BuilderView {
    zoom: number
    panX: number
    panY: number
}

const DEFAULT_VIEW: BuilderView = { zoom: 1, panX: 0, panY: 0 }
const HISTORY_CAP = 60

interface BuilderState {
    /** Whether the full-screen builder owns the viewport. */
    open: boolean
    /** Selected key indices (into `config.keyboard.keys`). */
    selection: Set<number>
    /** Active layer index (left-panel layers list; clamped to layers length). */
    activeLayer: number
    /** Snap-to-grid vs free-form placement (toolbar Seg toggle). */
    snapMode: SnapMode
    view: BuilderView
    past: ConfigKeymap[]
    future: ConfigKeymap[]
    /** Snapshot armed at gesture start; consumed by the first liveCommit. */
    pending: ConfigKeymap | null

    setOpen: (open: boolean) => void
    setSelection: (selection: Set<number>) => void
    clearSelection: () => void
    setActiveLayer: (index: number) => void
    setSnapMode: (mode: SnapMode) => void
    setView: (patch: Partial<BuilderView>) => void
    resetView: () => void

    /** Arm a snapshot for a drag gesture (no-op if already armed). */
    arm: () => void
    /** Discrete edit: push current config to history, then apply `next`. */
    commit: (next: ConfigKeymap) => void
    /** Gesture edit: the first call pushes the armed snapshot once; later calls
     *  in the same gesture just apply `next` without growing history. */
    liveCommit: (next: ConfigKeymap) => void
    /** End a gesture (drop any unconsumed armed snapshot). */
    endGesture: () => void
    undo: () => void
    redo: () => void
}

const pushCapped = (
    stack: ConfigKeymap[],
    entry: ConfigKeymap,
): ConfigKeymap[] => [...stack, entry].slice(-HISTORY_CAP)

const useBuilderStore = create<BuilderState>()(
    devtools((set, get) => ({
        open: false,
        selection: new Set<number>(),
        activeLayer: 0,
        snapMode: 'grid',
        view: DEFAULT_VIEW,
        past: [],
        future: [],
        pending: null,

        setOpen: (open) =>
            set(
                open
                    ? { open }
                    : {
                          open,
                          selection: new Set<number>(),
                          activeLayer: 0,
                          view: DEFAULT_VIEW,
                          past: [],
                          future: [],
                          pending: null,
                      },
            ),
        setSelection: (selection) => set({ selection }),
        clearSelection: () => set({ selection: new Set<number>() }),
        setActiveLayer: (activeLayer) => set({ activeLayer }),
        setSnapMode: (snapMode) => set({ snapMode }),
        setView: (patch) => set((s) => ({ view: { ...s.view, ...patch } })),
        resetView: () => set({ view: DEFAULT_VIEW }),

        arm: () => {
            if (get().pending) return
            const cur = useConfigStore.getState().config
            if (cur) set({ pending: cur })
        },
        commit: (next) => {
            const cur = useConfigStore.getState().config
            set((s) => ({
                past: cur ? pushCapped(s.past, cur) : s.past,
                future: [],
                pending: null,
            }))
            useConfigStore.getState().setConfig(next)
        },
        liveCommit: (next) => {
            const { pending } = get()
            if (pending) {
                set((s) => ({
                    past: pushCapped(s.past, pending),
                    future: [],
                    pending: null,
                }))
            }
            useConfigStore.getState().setConfig(next)
        },
        endGesture: () => set({ pending: null }),
        undo: () => {
            const { past } = get()
            if (!past.length) return
            const cur = useConfigStore.getState().config
            const prev = past[past.length - 1]
            set((s) => ({
                past: s.past.slice(0, -1),
                future: cur ? [cur, ...s.future] : s.future,
            }))
            useConfigStore.getState().setConfig(prev)
        },
        redo: () => {
            const { future } = get()
            if (!future.length) return
            const cur = useConfigStore.getState().config
            const nextCfg = future[0]
            set((s) => ({
                past: cur ? pushCapped(s.past, cur) : s.past,
                future: s.future.slice(1),
            }))
            useConfigStore.getState().setConfig(nextCfg)
        },
    })),
)

export default useBuilderStore
