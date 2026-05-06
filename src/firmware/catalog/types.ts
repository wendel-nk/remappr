// Pattern check: no GoF pattern (-) — rejected — plain data type definitions for catalog entries/pages, no abstraction needed.
// pattern-check: skip adding optional notes field to existing CatalogEntry data interface — mechanical extension
import type { ActionSlotKind } from '../types'

// Neutral domain id for a pickable key, e.g. 'key.letter.a',
// 'wireless.profile.1', 'mouse.cursor.up'. Stable across firmwares.
export type CanonicalKeyId = string

// pattern-check: skip optional field add to existing data interface — mechanical extension
export interface CatalogEntry {
    id: CanonicalKeyId
    label: string
    name: string
    description?: string
    // Platform-support / caveats (e.g. "Globe — iOS full, macOS partial").
    // Sourced from external-names EXTERNAL_NOTES; surfaced in tooltips.
    notes?: string
    x?: number
    y?: number
    w?: number
    h?: number
    kinds: ActionSlotKind[]
    // Alternate names from merged duplicate entries (e.g. "Keypad Backspace"
    // when merged into "Keyboard Backspace") plus external firmware spellings
    // (ZMK + QMK + KC_*/QK_*) from external-names EXTERNAL_NAMES. Picker
    // search includes these.
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
