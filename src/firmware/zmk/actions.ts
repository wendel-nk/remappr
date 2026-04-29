// Pattern check: Adapter (Tier 1) — extended — backs src/firmware/adapter.ts FirmwareAdapter; translates ZMK BehaviorBinding ↔ neutral KeyAction with slot-driven labels.
import type { BehaviorBinding } from '@zmkfirmware/zmk-studio-ts-client/keymap'
import type { GetBehaviorDetailsResponse } from '@zmkfirmware/zmk-studio-ts-client/behaviors'
import type { ActionSlot, KeyAction, KeyLabel } from '@firmware/types'
import {
    hid_usage_get_labels,
    hidUsagePageAndIdFromUsage,
} from '@/lib/behaviors/hidUsages'
import {
    abbreviateLayerName,
    formatMomentaryLayer,
} from '@/lib/keyAbbreviations'
import { displayNameToBinding } from '@/lib/keymap/displayNameToBinding'
import { behaviorToActionType } from './actionTypes'

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

function describeLayer(
    layerIndex: number,
    keymap: { layers: { name: string }[] },
): string {
    const layerName = keymap.layers[layerIndex]?.name
    const layerLabel = abbreviateLayerName(layerName, layerIndex)
    const mo = formatMomentaryLayer(layerIndex)
    return layerName ? `${mo} (${layerLabel})` : mo
}

function describeSlotValue(
    slot: ActionSlot,
    value: number,
    keymap: { layers: { name: string }[] },
): string {
    if (slot.kind === 'hid') return describeUsage(value)
    if (slot.kind === 'layer') return describeLayer(value, keymap)
    if ((slot.kind === 'enum' || slot.kind === 'modifier') && slot.values) {
        return slot.values.find((v) => v.value === value)?.label ?? `${value}`
    }
    return `${value}`
}

function buildHoldTapLabel(
    binding: BehaviorBinding,
    behavior: GetBehaviorDetailsResponse,
    slots: ActionSlot[],
    keymap: { layers: { name: string }[] },
): KeyLabel | undefined {
    if (slots.length !== 2) return undefined
    const tapDesc = describeSlotValue(slots[1], binding.param2, keymap)
    const holdDesc = describeSlotValue(slots[0], binding.param1, keymap)
    return {
        primary: tapDesc,
        secondary: holdDesc,
        description: `${behavior.displayName}\nTap: ${tapDesc}\nHold: ${holdDesc}`,
    }
}

export function buildKeyLabel(
    binding: BehaviorBinding,
    behaviors: BehaviorMap,
    keymap: { layers: { name: string }[] },
): KeyLabel {
    const behavior = behaviors[binding.behaviorId]
    if (!behavior) {
        return { primary: 'Unknown', description: 'Unknown' }
    }
    const slots = behaviorToActionType(behavior).slots
    const ht = buildHoldTapLabel(binding, behavior, slots, keymap)
    if (ht) return ht
    return {
        primary: behavior.displayName,
        description: behavior.displayName,
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
