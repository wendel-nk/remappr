import {
    Keymap,
    PhysicalLayout,
} from '@zmkfirmware/zmk-studio-ts-client/keymap'
import type { BehaviorMap } from '@/lib/behaviors/types'
import { DOM_KEY_TO_HID, DOM_KEY_TO_DISPLAY_NAME } from './domKeyToHidMap'

export interface KeypressDetectionConfig {
    layouts: PhysicalLayout[]
    keymap: Keymap
    selectedLayerIndex: number
    selectedPhysicalLayoutIndex: number
    behaviors: BehaviorMap
}

export function findKeyPositionForDomKey(
    domKeyCode: string,
    config: KeypressDetectionConfig,
): number | null {
    const layer = config.keymap?.layers?.[config.selectedLayerIndex]
    const layout = config.layouts?.[config.selectedPhysicalLayoutIndex]
    if (!layer || !layout) return null

    const hidUsageCode = DOM_KEY_TO_HID[domKeyCode]
    if (!hidUsageCode) return null

    const max = Math.min(layer.bindings.length, layout.keys.length)

    for (let i = 0; i < max; i++) {
        // ZMK binding format: (page << 16) | id — extract lower 16 bits
        const hidUsageIdFromBinding = layer.bindings[i].param1 & 0xffff
        if (hidUsageIdFromBinding === hidUsageCode) return i
    }

    const expectedName = DOM_KEY_TO_DISPLAY_NAME[domKeyCode]
    if (!expectedName) return null

    for (let i = 0; i < max; i++) {
        const behavior = config.behaviors[layer.bindings[i].behaviorId]
        if (behavior?.displayName === expectedName) return i
    }

    return null
}
