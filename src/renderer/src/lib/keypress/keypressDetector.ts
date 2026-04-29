// pattern-check: skip refactor — drop ZMK BehaviorMap dependency, match keys via neutral KeyAction.label
import type { Keymap, PhysicalLayout } from '@firmware/types'
import { DOM_KEY_TO_HID, DOM_KEY_TO_DISPLAY_NAME } from './domKeyToHidMap'

export interface KeypressDetectionConfig {
    layouts: PhysicalLayout[]
    keymap: Keymap
    selectedLayerIndex: number
    selectedPhysicalLayoutIndex: number
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

    const max = Math.min(layer.keys.length, layout.keys.length)

    for (let i = 0; i < max; i++) {
        const action = layer.keys[i]
        const usage = action.label.primaryUsage
        if (usage !== undefined && (usage & 0xffff) === hidUsageCode) return i
    }

    const expectedName = DOM_KEY_TO_DISPLAY_NAME[domKeyCode]
    if (!expectedName) return null

    for (let i = 0; i < max; i++) {
        if (layer.keys[i].label.primary === expectedName) return i
    }

    return null
}
