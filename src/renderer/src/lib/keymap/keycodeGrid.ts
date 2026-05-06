// Pattern check: no GoF pattern (-) — rejected — codemod renaming UsageId to CatalogEntry, field references Label→label/Id→id; pure type swap.
import type { CatalogEntry } from '@firmware/catalog/types'

export enum Mods {
    LeftControl = 0x01,
    LeftShift = 0x02,
    LeftAlt = 0x04,
    LeftGUI = 0x08,
    RightControl = 0x10,
    RightShift = 0x20,
    RightAlt = 0x40,
    RightGUI = 0x80,
}

const all_mods: readonly Mods[] = [
    Mods.LeftControl,
    Mods.LeftShift,
    Mods.LeftAlt,
    Mods.LeftGUI,
    Mods.RightControl,
    Mods.RightShift,
    Mods.RightAlt,
    Mods.RightGUI,
]

const MODS_FLAGS_SHIFTED =
    all_mods.reduce((a: number, v: Mods): number => a | v, 0) << 24

export function maskMods(value: number): number {
    return value & ~MODS_FLAGS_SHIFTED
}

// pattern-check: skip pure helper for filterKeysBySearch ranking — single private caller
// Pattern check: no GoF pattern (-) — rejected — pure scoring helper for the picker filter, single caller, no abstraction or family of behaviours.
function scoreEntry(entry: CatalogEntry, lq: string): number {
    const label = entry.label.replace(/<[^>]*>/g, '').toLowerCase()
    const name = entry.name.toLowerCase()
    const id = entry.id.toLowerCase()
    const aliasesLower = (entry.aliases ?? []).map((a) => a.toLowerCase())

    if (label === lq) return 100
    if (name === lq) return 90
    if (aliasesLower.includes(lq)) return 80
    if (id === lq) return 70

    if (label.startsWith(lq)) return 50
    if (name.startsWith(lq)) return 40
    if (aliasesLower.some((a) => a.startsWith(lq))) return 30

    if (label.includes(lq)) return 20
    if (name.includes(lq)) return 15
    if (id.includes(lq)) return 12
    if (aliasesLower.some((a) => a.includes(lq))) return 10

    return 0
}

// pattern-check: skip refinement of existing pure filter — substring → ranked filter+sort, same call sites
export function filterKeysBySearch(
    keys: CatalogEntry[],
    query: string,
): CatalogEntry[] {
    if (!query.trim()) return keys
    const lq = query.toLowerCase()
    const scored: { entry: CatalogEntry; score: number; idx: number }[] = []
    keys.forEach((entry, idx) => {
        const score = scoreEntry(entry, lq)
        if (score > 0) scored.push({ entry, score, idx })
    })
    scored.sort((a, b) => b.score - a.score || a.idx - b.idx)
    return scored.map((s) => s.entry)
}

export function splitKeysByPosition(keys: CatalogEntry[]): {
    withPositions: CatalogEntry[]
    withoutPositions: CatalogEntry[]
} {
    const withPositions = keys.filter(
        (key) =>
            key.x !== undefined &&
            key.y !== undefined &&
            key.x !== null &&
            key.y !== null,
    )
    const withoutPositions = keys.filter(
        (key) =>
            key.x === undefined ||
            key.y === undefined ||
            key.x === null ||
            key.y === null,
    )
    return { withPositions, withoutPositions }
}

const KEY_SIZE = 50
const AVG_KEY_WIDTH = 60
const APPROX_CONTAINER_WIDTH = 800
const ROW_HEIGHT = 60
const PADDING = 48
const STACK_GAP = 10
const MIN_HEIGHT = 350

export function calculateContainerHeight(
    withPositions: CatalogEntry[],
    withoutPositions: CatalogEntry[],
): number {
    const maxBottomPosition = maxBottomForPositioned(withPositions)

    let keysWithoutPosHeight = 0
    if (withoutPositions.length > 0) {
        const keysPerRow = Math.floor(APPROX_CONTAINER_WIDTH / AVG_KEY_WIDTH)
        const numRows = Math.ceil(withoutPositions.length / keysPerRow)
        keysWithoutPosHeight = numRows * ROW_HEIGHT
    }

    const totalContentHeight =
        withPositions.length > 0 && withoutPositions.length > 0
            ? maxBottomPosition + STACK_GAP + keysWithoutPosHeight + PADDING
            : Math.max(
                  maxBottomPosition + PADDING,
                  keysWithoutPosHeight + PADDING,
              )
    return Math.max(totalContentHeight, MIN_HEIGHT)
}

export function maxBottomForPositioned(withPositions: CatalogEntry[]): number {
    let maxBottom = 0
    withPositions.forEach((key) => {
        const keyHeight = key.h ? key.h / 2 : KEY_SIZE
        const bottomPosition = ((key.y ?? 0) / 100) * KEY_SIZE + keyHeight
        if (bottomPosition > maxBottom) maxBottom = bottomPosition
    })
    return maxBottom
}
