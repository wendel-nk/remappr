// Pattern check: no GoF pattern (-) — rejected — pure CanonAction → KeyCategory
// mappers (face + accent) lifted out of builderCapProps; named lookup, no
// abstraction or polymorphism.
//
// The builder's parallel to lib/keymap's categoryForBinding / faceCategoryForBinding
// (which classify a device-resolved binding). Here the input is a firmware-neutral
// CanonAction. Kept in features/ (not lib/) because deriving a key's category needs
// the HID-usage mockCodec; lib/ stays pure of firmware codecs. The face/accent split
// mirrors the editor: a tap-hold's face follows its tap key while the accent follows
// the hold function.
import { mockCodec } from '@firmware/mock/codec'
import type { CanonAction } from '@firmware/config'
import { categoryForUsage, type KeyCategory } from '@/lib/keymap/keyCategory'

/** Face category of a CanonicalKeyId: its HID-usage category, else neutral alpha. */
function keyCategory(key: string): KeyCategory {
    const v = mockCodec.encode(key)?.value
    return v !== undefined ? categoryForUsage(v) : 'alpha'
}

/**
 * Face (cap-fill) category for a CanonAction — tints the cap, dot and tap legend.
 * A tap-hold key follows its TAP key (a home-row mod on `A` stays a neutral alpha
 * cap), matching {@link faceCategoryForBinding} on the editor side.
 */
export function categoryForCanonAction(
    a: CanonAction | undefined,
): KeyCategory {
    if (!a) return 'system'
    switch (a.type) {
        case 'transparent':
        case 'none':
            return 'trans'
        case 'key_press':
        case 'sticky_key':
            return keyCategory(a.key)
        case 'tap_hold':
            return keyCategory(a.tap.key)
        case 'layer':
            return 'layer'
        case 'mouse_key':
        case 'mouse_move':
        case 'mouse_scroll':
            return 'mouse'
        case 'caps_word':
            return 'mod'
        case 'key_repeat':
        case 'grave_escape':
            return 'edit'
        case 'macro':
        case 'tap_dance':
        case 'output':
        case 'ext_power':
        case 'lighting':
        case 'bootloader':
        case 'reset':
        case 'soft_off':
        case 'studio_unlock':
            return 'system'
        default:
            return 'system'
    }
}

/**
 * Accent (function) category for a CanonAction — colours the header tag + hold
 * legend only, leaving the face neutral. A modified key-press, a sticky key and a
 * mod-tap read as modifiers; a layer-tap reads as a layer. `undefined` means "no
 * accent" (KeyButton then falls back to the face category).
 */
export function accentCategoryForCanonAction(
    a: CanonAction | undefined,
): KeyCategory | undefined {
    if (!a) return undefined
    switch (a.type) {
        case 'key_press':
            return a.mods?.length ? 'mod' : undefined
        case 'sticky_key':
            return 'mod'
        case 'tap_hold':
            return a.hold.type === 'modifier' ? 'mod' : 'layer'
        default:
            return undefined
    }
}
