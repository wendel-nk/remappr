// Pattern check: no GoF pattern (-) — rejected — plain data type definitions for catalog entries/pages, no abstraction needed.
import type {ActionSlotKind} from '../types'

// Neutral domain id for a pickable key, e.g. 'key.letter.a',
// 'wireless.profile.1', 'mouse.cursor.up'. Stable across firmwares.
export type CanonicalKeyId = string

export interface CatalogEntry {
    id: CanonicalKeyId
    label: string
    name: string
    description?: string
    x?: number
    y?: number
    w?: number
    h?: number
    kinds: ActionSlotKind[]
    // Alternate names from merged duplicate entries (e.g. "Keypad Backspace"
    // when merged into "Keyboard Backspace"). Picker search includes these.
    aliases?: string[]
}

export interface CatalogPage {
    id: string
    name: string
    style: 'keyboard-grid' | 'flat-grid'
    visible: boolean
    entries: CatalogEntry[]
}

export interface KeyCatalog {
    pages: CatalogPage[]
}
