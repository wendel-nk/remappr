// Pattern check: no GoF pattern (-) — rejected — transient single-slot store holding the
// layer index currently hover-previewed in the sidebar; mirrors layerSelectionStore, no abstraction.
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

/**
 * Hover-preview ("peek") layer. Set while the pointer is over a layer in the sidebar so
 * the stage can render that layer's bindings without changing the real selection. Not persisted.
 */
interface LayerPeekState {
    peekLayerIndex: number | null
    setPeek: (index: number | null) => void
}

const useLayerPeekStore = create<LayerPeekState>()(
    devtools((set) => ({
        peekLayerIndex: null,
        setPeek: (peekLayerIndex) => set({ peekLayerIndex }),
    })),
)

export default useLayerPeekStore
