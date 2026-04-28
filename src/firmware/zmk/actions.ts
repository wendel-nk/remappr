// Pattern check: Adapter (Tier 1) — extended — backs src/firmware/adapter.ts FirmwareAdapter; translates ZMK BehaviorBinding ↔ neutral KeyAction.
import type { BehaviorBinding } from '@zmkfirmware/zmk-studio-ts-client/keymap'
import type { GetBehaviorDetailsResponse } from '@zmkfirmware/zmk-studio-ts-client/behaviors'
import type { KeyAction, KeyLabel } from '@firmware/types'
import { HoldTapType, parseHoldTapBinding } from '@/lib/behaviors/holdTap'
import {
    hid_usage_get_labels,
    hidUsagePageAndIdFromUsage,
} from '@/lib/behaviors/hidUsages'
import {
    abbreviateLayerName,
    formatMomentaryLayer,
} from '@/lib/keyAbbreviations'
import { displayNameToBinding } from '@/lib/keymap/displayNameToBinding'

export type BehaviorMap = Record<number, GetBehaviorDetailsResponse>

export interface ZmkBindingParams {
    behaviorId: number
    param1: number
    param2: number
}

function describeUsage(usage: number): string {
    const [pageMut, id] = hidUsagePageAndIdFromUsage(usage)
    const page = pageMut & 0xff
    const labels = hid_usage_get_labels(page, id)
    const long = labels.long || labels.med || labels.short
    return long ? long.replace(/^Keyboard /, '') : `0x${usage.toString(16)}`
}

function buildHoldTapLabel(
    binding: BehaviorBinding,
    behaviors: BehaviorMap,
    keymap: { layers: { name: string }[] },
): KeyLabel | undefined {
    const parsed = parseHoldTapBinding(binding, behaviors)
    if (!parsed || !parsed.hasTapAndHold || parsed.tapParam === undefined) {
        return undefined
    }
    const behaviorName = behaviors[binding.behaviorId]?.displayName || ''
    const tapDesc = describeUsage(parsed.tapParam)
    if (parsed.type === HoldTapType.LayerTap) {
        const layerIndex = parsed.holdParam
        const layerName = keymap.layers[layerIndex]?.name
        const layerLabel = abbreviateLayerName(layerName, layerIndex)
        const mo = formatMomentaryLayer(layerIndex)
        const holdDesc = layerName ? `${mo} (${layerLabel})` : mo
        return {
            primary: tapDesc,
            secondary: holdDesc,
            description: `${behaviorName}\nTap: ${tapDesc}\nHold: ${holdDesc}`,
        }
    }
    const holdDesc = describeUsage(parsed.holdParam)
    return {
        primary: tapDesc,
        secondary: holdDesc,
        description: `${behaviorName}\nTap: ${tapDesc}\nHold: ${holdDesc}`,
    }
}

export function buildKeyLabel(
    binding: BehaviorBinding,
    behaviors: BehaviorMap,
    keymap: { layers: { name: string }[] },
): KeyLabel {
    const holdTap = buildHoldTapLabel(binding, behaviors, keymap)
    if (holdTap) return holdTap
    const behavior = behaviors[binding.behaviorId]
    const displayName = behavior?.displayName || 'Unknown'
    return {
        primary: displayName,
        description: displayName,
    }
}

export function bindingToKeyAction(
    binding: BehaviorBinding,
    behaviors: BehaviorMap,
    keymap: { layers: { name: string }[] },
): KeyAction {
    const behavior = behaviors[binding.behaviorId]
    const kind = behavior?.displayName || 'Unknown'
    return {
        kind,
        params: {
            behaviorId: binding.behaviorId,
            param1: binding.param1,
            param2: binding.param2,
        } satisfies ZmkBindingParams,
        label: buildKeyLabel(binding, behaviors, keymap),
    }
}

export function keyActionToBinding(action: KeyAction): BehaviorBinding {
    const params = action.params as ZmkBindingParams
    return {
        behaviorId: params.behaviorId,
        param1: params.param1,
        param2: params.param2,
    } as BehaviorBinding
}

export function bindingPrefix(behavior: GetBehaviorDetailsResponse): string {
    return displayNameToBinding(behavior.displayName)
}
