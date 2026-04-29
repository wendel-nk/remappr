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

export interface ZmkBindingView {
    behaviorId: number
    param1: number
    param2: number
}

export function zmkBindingFromAction(action: KeyAction): ZmkBindingView {
    const behaviorId = Number.parseInt(action.kind, 10)
    return {
        behaviorId: Number.isNaN(behaviorId) ? 0 : behaviorId,
        param1: action.params[0] ?? 0,
        param2: action.params[1] ?? 0,
    }
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
    return {
        kind: String(binding.behaviorId),
        params: [binding.param1, binding.param2],
        label: buildKeyLabel(binding, behaviors, keymap),
    }
}

export function keyActionToBinding(action: KeyAction): BehaviorBinding {
    const view = zmkBindingFromAction(action)
    return {
        behaviorId: view.behaviorId,
        param1: view.param1,
        param2: view.param2,
    } as BehaviorBinding
}

export function bindingPrefix(behavior: GetBehaviorDetailsResponse): string {
    return displayNameToBinding(behavior.displayName)
}
