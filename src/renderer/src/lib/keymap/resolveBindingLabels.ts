// Pattern check: Adapter (Tier 1) — extended — backs src/firmware/adapter.ts FirmwareAdapter; resolves neutral KeyAction.params (ZmkBindingParams) into UI label descriptors using ZMK behavior metadata.
import type { GetBehaviorDetailsResponse } from '@firmware/zmk'

import type { Keymap, PhysicalLayout } from '@firmware/types'
import type { ZmkBindingParams } from '@firmware/zmk/actions'

import { HoldTapType, parseHoldTapBinding } from '@/lib/behaviors/holdTap'
import {
    formatMomentaryLayer,
    abbreviateLayerName,
} from '@/lib/keyAbbreviations'
import {
    hid_usage_get_labels,
    hidUsagePageAndIdFromUsage,
} from '@/lib/behaviors/hidUsages'
import { displayNameToBinding } from '@/lib/keymap/displayNameToBinding'

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
    binding: ZmkBindingParams,
    behaviors: BehaviorMap,
    keymap: Keymap,
): ResolvedHoldTapDescriptor | undefined {
    const parsed = parseHoldTapBinding(binding, behaviors)
    if (!parsed || !parsed.hasTapAndHold || parsed.tapParam === undefined) {
        return undefined
    }

    const behaviorName = behaviors[binding.behaviorId]?.displayName || ''
    const behaviorBinding = displayNameToBinding(behaviorName)
    const tapDesc = describeUsage(parsed.tapParam)

    if (parsed.type === HoldTapType.LayerTap) {
        const layerIndex = parsed.holdParam
        const layerName = keymap.layers[layerIndex]?.name
        const layerLabel = abbreviateLayerName(layerName, layerIndex)
        const mo = formatMomentaryLayer(layerIndex)
        const holdDesc = layerName ? `${mo} (${layerLabel})` : mo
        return {
            behaviorName,
            behaviorBinding,
            tapParam: parsed.tapParam,
            tapDesc,
            holdNodeKind: 'layer',
            holdParam: parsed.holdParam,
            holdLayerLabel: layerLabel,
            holdLayerMomentary: mo,
            holdLayerName: layerName,
            tooltip: `${behaviorName}\nTap: ${tapDesc}\nHold: ${holdDesc}`,
        }
    }

    const holdDesc = describeUsage(parsed.holdParam)
    return {
        behaviorName,
        behaviorBinding,
        tapParam: parsed.tapParam,
        tapDesc,
        holdNodeKind: 'usage',
        holdParam: parsed.holdParam,
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
        const binding = action ? (action.params as ZmkBindingParams) : undefined
        const holdTap = binding
            ? buildHoldTapDescriptor(binding, behaviors, keymap)
            : undefined
        const behaviorName = binding
            ? behaviors[binding.behaviorId]?.displayName || 'Unknown'
            : 'Unknown'

        const behaviorBinding = binding
            ? displayNameToBinding(behaviorName)
            : undefined
        return {
            id: `${keymap.layers[selectedLayerIndex].id}-${i}`,
            header: behaviorName,
            behaviorBinding,
            holdTap,
            bindingParam1: binding?.param1,
            behaviorName: binding
                ? behaviors[binding.behaviorId]?.displayName
                : undefined,
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
