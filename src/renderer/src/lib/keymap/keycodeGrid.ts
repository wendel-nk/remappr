// pattern-check: skip pure-extraction codemod from KeycodePickerGrid
import type { KeyboardKeys } from '@/data/keys'

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

export const all_mods: Mods[] = [
    Mods.LeftControl,
    Mods.LeftShift,
    Mods.LeftAlt,
    Mods.LeftGUI,
    Mods.RightControl,
    Mods.RightShift,
    Mods.RightAlt,
    Mods.RightGUI,
]

export const mod_labels: Record<Mods, string> = {
    [Mods.LeftControl]: 'L Ctrl',
    [Mods.LeftShift]: 'L Shift',
    [Mods.LeftAlt]: 'L Alt',
    [Mods.LeftGUI]: 'L GUI',
    [Mods.RightControl]: 'R Ctrl',
    [Mods.RightShift]: 'R Shift',
    [Mods.RightAlt]: 'R Alt',
    [Mods.RightGUI]: 'R GUI',
}

export function modsToFlags(mods: Mods[]): number {
    return mods.reduce((a: number, v: Mods): number => a + v, 0)
}

export function maskMods(value: number): number {
    return value & ~(modsToFlags(all_mods) << 24)
}

export type UsageId = KeyboardKeys['UsageIds'][number]

export function filterKeysBySearch(keys: UsageId[], query: string): UsageId[] {
    if (!query.trim()) return keys
    const lowerQuery = query.toLowerCase()
    return keys.filter((key) => {
        const label = key.Label || ''
        const textContent = label.replace(/<[^>]*>/g, '').toLowerCase()
        return textContent.includes(lowerQuery)
    })
}

export function splitKeysByPosition(keys: UsageId[]): {
    withPositions: UsageId[]
    withoutPositions: UsageId[]
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
    withPositions: UsageId[],
    withoutPositions: UsageId[],
): number {
    let maxBottomPosition = 0
    withPositions.forEach((key) => {
        const keyHeight = 'h' in key && key.h ? key.h / 2 : KEY_SIZE
        const bottomPosition = (key.y! / 100) * KEY_SIZE + keyHeight
        if (bottomPosition > maxBottomPosition)
            maxBottomPosition = bottomPosition
    })

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

export function maxBottomForPositioned(withPositions: UsageId[]): number {
    let maxBottom = 0
    withPositions.forEach((key) => {
        const keyHeight = 'h' in key && key.h ? key.h / 2 : KEY_SIZE
        const bottomPosition = (key.y! / 100) * KEY_SIZE + keyHeight
        if (bottomPosition > maxBottom) maxBottom = bottomPosition
    })
    return maxBottom
}
