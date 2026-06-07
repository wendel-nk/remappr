// pattern-check: skip — non-persisted zustand UI-state slice for the RGB bottom sheet
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

/**
 * Visibility + active section of the RGB lighting bottom sheet. Lives in a store
 * (not local state) so the Header's Lightbulb trigger and the KeymapEditor that
 * renders the sheet — siblings under SidebarInset — stay decoupled. Session-only.
 */
export type RgbSheetSection =
    | 'backlight'
    | 'perkey'
    | 'mix'
    | 'underglow'
    | 'indicator'
    | 'advanced'

interface RgbSheetState {
    open: boolean
    section: RgbSheetSection
    setOpen: (open: boolean) => void
    toggle: () => void
    setSection: (section: RgbSheetSection) => void
}

const useRgbSheetStore = create<RgbSheetState>()(
    devtools((set) => ({
        open: false,
        section: 'backlight',
        setOpen: (open) => set({ open }),
        toggle: () => set((s) => ({ open: !s.open })),
        setSection: (section) => set({ section }),
    })),
)

export default useRgbSheetStore
