// pattern-check: skip — pure modifier-bit helpers extracted from KeycodePickerGrid, no abstraction

const KEYBOARD_PAGE = 7
const MOD_ID_LOW = 0xe0
const MOD_ID_HIGH = 0xe7

export function isModifierKey(page: number, id: number): boolean {
    return page === KEYBOARD_PAGE && id >= MOD_ID_LOW && id <= MOD_ID_HIGH
}

export function idToModBit(id: number): number {
    return 1 << (id - MOD_ID_LOW)
}

export function emitFromState(
    base: number | undefined,
    flags: number,
): number | undefined {
    if (base !== undefined) return base | (flags << 24)
    if (flags === 0) return undefined
    for (let i = 0; i < 8; i++) {
        const bit = 1 << i
        if (flags & bit) {
            const baseHid = (KEYBOARD_PAGE << 16) | (MOD_ID_LOW + i)
            return baseHid | ((flags & ~bit) << 24)
        }
    }
    return undefined
}
