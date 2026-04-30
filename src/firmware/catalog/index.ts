// Pattern check: no GoF pattern (-) — rejected — barrel file re-exporting catalog public surface for @firmware/catalog consumers.
export type {
    CanonicalKeyId,
    CatalogEntry,
    CatalogPage,
    KeyCatalog,
} from './types'
export {
    AC_ENTRIES,
    AL_ENTRIES,
    CATALOG,
    CONSUMER_ENTRIES,
    CONTACT_ENTRIES,
    HID_USAGE_BY_CANONICAL,
    KEYBOARD_ENTRIES,
    MEDIA_ENTRIES,
} from './entries'
export type { HidUsage } from './entries'
export { CATALOG_PAGES, groupForId } from './pages'
