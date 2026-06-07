// pattern-check: skip — session zustand slice for the connected board's lighting catalog
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { LightingCatalog } from '@firmware/lighting'

/**
 * Per-board lighting catalog parsed from the connected/imported VIA definition's
 * `menus` (the board's real effect names + which controls it exposes). When set,
 * the RGB modal uses it instead of the hardcoded full QMK enum. Session-only;
 * populated on layout import / auto-resolve, cleared on disconnect.
 */
interface LightingCatalogState {
    catalog: LightingCatalog | null
    setCatalog: (catalog: LightingCatalog | null) => void
}

const useLightingCatalogStore = create<LightingCatalogState>()(
    devtools((set) => ({
        catalog: null,
        setCatalog: (catalog) => set({ catalog }),
    })),
)

export default useLightingCatalogStore
