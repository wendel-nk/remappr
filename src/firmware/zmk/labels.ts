// Pattern check: Adapter (Tier 1) — extended — backs src/firmware/adapter.ts FirmwareAdapter; resolves neutral KeyAction labels via behaviorToActionType slot kinds.
import type { GetBehaviorDetailsResponse } from '@firmware/zmk'
import { behaviorToActionType } from '@firmware/zmk'
import type { ActionSlot, Keymap, PhysicalLayout } from '@firmware/types'
import {
    zmkBindingFromAction,
    type ZmkBindingView,
} from '@firmware/zmk/actions'

import {
    abbreviateLayerName,
    formatMomentaryLayer,
} from '@/lib/keyAbbreviations'
import {
    hid_usage_get_labels,
    hidUsagePageAndIdFromUsage,
} from '@/lib/behaviors/hidUsages'
import { displayNameToBinding } from '@firmware/zmk/displayNameToBinding'

type BehaviorMap = Record<number, GetBehaviorDetailsResponse>

export interface ResolvedHoldTapDescriptor {
    behaviorName: string
    behaviorBinding: string
    tapParam: number
    tapDesc: string
    holdNodeKind: 'layer' | 'usage'
    holdParam: number
    holdLayerLabel?: string
    holdLayerMomentary?: string
    holdLayerName?: string
    holdUsageDesc?: string
    tooltip: string
}

export interface ResolvedBindingPosition {
    id: string
    header: string
    behaviorBinding?: string
    holdTap?: ResolvedHoldTapDescriptor
    bindingParam1?: number
    behaviorName?: string
    outOfRange: boolean
    x: number
    y: number
    width: number
    height: number
    r: number
    rx: number
    ry: number
}

function describeUsage(usage: number): string {
    const [pageMut, id] = hidUsagePageAndIdFromUsage(usage)
    const page = pageMut & 0xff
    const labels = hid_usage_get_labels(page, id)
    const long = labels.long || labels.med || labels.short
    return long ? long.replace(/^Keyboard /, '') : `0x${usage.toString(16)}`
}

function buildHoldTapDescriptor(
    binding: ZmkBindingView,
    behavior: GetBehaviorDetailsResponse,
    slots: ActionSlot[],
    keymap: Keymap,
): ResolvedHoldTapDescriptor | undefined {
    if (slots.length !== 2) return undefined

    const behaviorName = behavior.displayName
    const behaviorBinding = displayNameToBinding(behaviorName)
    const tapParam = binding.param2
    const holdParam = binding.param1
    const tapDesc = describeUsage(tapParam)

    if (slots[0].kind === 'layer') {
        const layerName = keymap.layers[holdParam]?.name
        const layerLabel = abbreviateLayerName(layerName, holdParam)
        const mo = formatMomentaryLayer(holdParam)
        const holdDesc = layerName ? `${mo} (${layerLabel})` : mo
        return {
            behaviorName,
            behaviorBinding,
            tapParam,
            tapDesc,
            holdNodeKind: 'layer',
            holdParam,
            holdLayerLabel: layerLabel,
            holdLayerMomentary: mo,
            holdLayerName: layerName,
            tooltip: `${behaviorName}\nTap: ${tapDesc}\nHold: ${holdDesc}`,
        }
    }

    const holdDesc = describeUsage(holdParam)
    return {
        behaviorName,
        behaviorBinding,
        tapParam,
        tapDesc,
        holdNodeKind: 'usage',
        holdParam,
        holdUsageDesc: holdDesc,
        tooltip: `${behaviorName}\nTap: ${tapDesc}\nHold: ${holdDesc}`,
    }
}

export function resolveBindingLabels(
    layout: PhysicalLayout,
    keymap: Keymap,
    behaviors: BehaviorMap,
    selectedLayerIndex: number,
): ResolvedBindingPosition[] {
    if (!keymap.layers[selectedLayerIndex]) return []
    return layout.keys.map((k, i) => {
        const layerKeys = keymap.layers[selectedLayerIndex].keys
        const outOfRange = i >= layerKeys.length
        const action = outOfRange ? undefined : layerKeys[i]
        const binding = action ? zmkBindingFromAction(action) : undefined
        const behavior = binding ? behaviors[binding.behaviorId] : undefined
        const slots = behavior ? behaviorToActionType(behavior).slots : []
        const holdTap =
            binding && behavior
                ? buildHoldTapDescriptor(binding, behavior, slots, keymap)
                : undefined
        const behaviorName = behavior?.displayName || 'Unknown'
        const behaviorBinding = binding
            ? displayNameToBinding(behaviorName)
            : undefined
        return {
            id: `${keymap.layers[selectedLayerIndex].id}-${i}`,
            header: behaviorName,
            behaviorBinding,
            holdTap,
            bindingParam1: binding?.param1,
            behaviorName: behavior?.displayName,
            outOfRange,
            x: k.x / 100.0,
            y: k.y / 100.0,
            width: k.w / 100,
            height: k.h / 100.0,
            r: (k.r || 0) / 100.0,
            rx: (k.rx || 0) / 100.0,
            ry: (k.ry || 0) / 100.0,
        }
    })
}
