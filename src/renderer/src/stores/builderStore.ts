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
import { connectMockWithConfig } from '@firmware'
import useConfigStore from '@/stores/configStore'
import useConnectionStore from '@/stores/connectionStore'

export type SnapMode = 'grid' | 'free'

// Pattern check: no GoF pattern (-) — rejected — additive plain data types +
// zustand state for the picker-open target; discriminated slot string, no abstraction.
/** Which binding slot the picker edits: a key's base binding, an encoder's
 *  clockwise / counter-clockwise / press slot, or a slider's custom action. */
export type BindingSlot = 'key' | 'cw' | 'ccw' | 'press' | 'slider'

/** The key (and slot) the binding picker is currently editing. */
export interface BindingTarget {
    keyIndex: number
    slot: BindingSlot
}

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
    /** Active physical-layout variant id ('' = show all / common keys). */
    activeVariant: string
    /** Whether the matrix-wiring overlay is shown on the canvas. */
    matrixView: boolean
    /** Whether the right dock shows the JSON config editor instead of the inspector. */
    jsonOpen: boolean
    /** Snap-to-grid vs free-form placement (toolbar Seg toggle). */
    snapMode: SnapMode
    /** Whether placement actually snaps. Switching the Seg sets it (grid→on,
     *  free→off); the standalone toolbar toggle flips it independently. */
    snapping: boolean
    /** When on, manually changing a key's matrix row/col also snaps its position
     *  to the whole-U grid (the design's "Snap to grid on row/col change"). */
    snapOnWire: boolean
    view: BuilderView
    past: ConfigKeymap[]
    future: ConfigKeymap[]
    /** Snapshot armed at gesture start; consumed by the first liveCommit. */
    pending: ConfigKeymap | null
    /** The key/slot the binding picker is editing, or null when it's closed. */
    binding: BindingTarget | null

    setOpen: (open: boolean) => void
    openBinding: (target: BindingTarget) => void
    closeBinding: () => void
    setSelection: (selection: Set<number>) => void
    clearSelection: () => void
    setActiveLayer: (index: number) => void
    setActiveVariant: (id: string) => void
    toggleMatrixView: () => void
    setJsonOpen: (open: boolean) => void
    toggleJson: () => void
    setSnapMode: (mode: SnapMode) => void
    toggleSnapping: () => void
    toggleSnapOnWire: () => void
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

    /** "Open in editor" handoff: spin up a demo service seeded from the current
     *  config and close the builder, so App's service branch shows the editor. */
    openInEditor: () => void
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
        activeVariant: '',
        matrixView: false,
        jsonOpen: false,
        snapMode: 'grid',
        snapping: true,
        snapOnWire: false,
        view: DEFAULT_VIEW,
        past: [],
        future: [],
        pending: null,
        binding: null,

        setOpen: (open) =>
            set(
                open
                    ? { open }
                    : {
                          open,
                          selection: new Set<number>(),
                          activeLayer: 0,
                          activeVariant: '',
                          matrixView: false,
                          jsonOpen: false,
                          view: DEFAULT_VIEW,
                          past: [],
                          future: [],
                          pending: null,
                          binding: null,
                      },
            ),
        openBinding: (binding) => set({ binding }),
        closeBinding: () => set({ binding: null }),
        setSelection: (selection) => set({ selection }),
        clearSelection: () => set({ selection: new Set<number>() }),
        setActiveLayer: (activeLayer) => set({ activeLayer }),
        setActiveVariant: (activeVariant) => set({ activeVariant }),
        toggleMatrixView: () => set((s) => ({ matrixView: !s.matrixView })),
        setJsonOpen: (jsonOpen) => set({ jsonOpen }),
        toggleJson: () => set((s) => ({ jsonOpen: !s.jsonOpen })),
        setSnapMode: (snapMode) =>
            set({ snapMode, snapping: snapMode === 'grid' }),
        toggleSnapping: () => set((s) => ({ snapping: !s.snapping })),
        toggleSnapOnWire: () => set((s) => ({ snapOnWire: !s.snapOnWire })),
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

        openInEditor: () => {
            const cfg = useConfigStore.getState().config
            if (!cfg) return
            const service = connectMockWithConfig(cfg)
            const conn = useConnectionStore.getState()
            // Mirror App's demo-connect lifecycle: clear the connection when the
            // service closes. setService re-seeds configStore from the service's
            // getConfigSource (the serialized board), keeping it source-of-truth.
            service.onClosed(() => {
                useConnectionStore.getState().setDeviceName(null)
                useConnectionStore.getState().setService(null)
            })
            conn.setDeviceName(service.deviceInfo.name)
            conn.setService(service)
            get().setOpen(false)
        },
    })),
)

export default useBuilderStore
