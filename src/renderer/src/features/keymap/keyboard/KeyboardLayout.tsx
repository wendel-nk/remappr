import { useMemo } from 'react'
import {
    PhysicalLayout,
    Keymap as KeymapMsg,
} from '@zmkfirmware/zmk-studio-ts-client/keymap'
import type { GetBehaviorDetailsResponse } from '@zmkfirmware/zmk-studio-ts-client/behaviors'

import { PhysicalLayout as PhysicalLayoutComp } from './PhysicalLayout.tsx'
import { HidUsageLabel } from './HidUsageLabel.tsx'
import { HoldTapLabels } from './Key.tsx'
import { LayoutZoom } from '@/lib/helpers.ts'
import { HoldTapType, parseHoldTapBinding } from '@/lib/behaviors/holdTap.ts'
import {
    formatMomentaryLayer,
    abbreviateLayerName,
} from '@/lib/keyAbbreviations.ts'
import {
    hid_usage_get_labels,
    hidUsagePageAndIdFromUsage,
} from '@/lib/behaviors/hidUsages.ts'

const EMPTY_PRESSED_KEYS: ReadonlySet<number> = new Set()

type BehaviorMap = Record<number, GetBehaviorDetailsResponse>

function describeUsage(usage: number): string {
    const [pageMut, id] = hidUsagePageAndIdFromUsage(usage)
    const page = pageMut & 0xff
    const labels = hid_usage_get_labels(page, id)
    const long = labels.long || labels.med || labels.short
    return long ? long.replace(/^Keyboard /, '') : `0x${usage.toString(16)}`
}

function buildHoldTapLabels(
    binding: { behaviorId: number; param1: number; param2: number },
    behaviors: BehaviorMap,
    keymap: KeymapMsg,
): HoldTapLabels | undefined {
    const parsed = parseHoldTapBinding(binding, behaviors)
    if (!parsed || !parsed.hasTapAndHold || parsed.tapParam === undefined) {
        return undefined
    }

    const behaviorName = behaviors[binding.behaviorId]?.displayName || ''
    const tapNode = (
        <HidUsageLabel hid_usage={parsed.tapParam} header={behaviorName} />
    )
    const tapDesc = describeUsage(parsed.tapParam)

    let holdNode: React.ReactNode
    let holdDesc: string

    if (parsed.type === HoldTapType.LayerTap) {
        const layerIndex = parsed.holdParam
        const layerName = keymap.layers[layerIndex]?.name
        const layerLabel = abbreviateLayerName(layerName, layerIndex)
        const mo = formatMomentaryLayer(layerIndex)
        holdNode = <span>{mo}</span>
        holdDesc = layerName ? `${mo} (${layerLabel})` : mo
    } else {
        holdNode = <HidUsageLabel hid_usage={parsed.holdParam} />
        holdDesc = describeUsage(parsed.holdParam)
    }

    return {
        tap: tapNode,
        hold: holdNode,
        tooltip: `${behaviorName}\nTap: ${tapDesc}\nHold: ${holdDesc}`,
    }
}

export interface KeymapProps {
    layout: PhysicalLayout
    keymap: KeymapMsg
    behaviors: BehaviorMap
    scale: LayoutZoom
    selectedLayerIndex: number
    selectedKeyPosition: number | undefined
    onKeyPositionClicked: (keyPosition: number) => void
    pressedKeys?: Set<number>
}

export const KeyboardLayout = ({
    layout,
    keymap,
    behaviors,
    scale,
    selectedLayerIndex,
    selectedKeyPosition,
    onKeyPositionClicked,
    pressedKeys = EMPTY_PRESSED_KEYS as Set<number>,
}: KeymapProps): JSX.Element => {
    const positions = useMemo(() => {
        if (!keymap.layers[selectedLayerIndex]) return []
        return layout.keys.map(
            (
                k: {
                    x: number
                    y: number
                    width: number
                    height: number
                    r?: number
                    rx?: number
                    ry?: number
                },
                i: number,
            ): {
                id: string
                header: string
                holdTap?: HoldTapLabels
                x: number
                y: number
                width: number
                height: number
                r: number
                rx: number
                ry: number
                children: JSX.Element
            } => {
                const binding = keymap.layers[selectedLayerIndex].bindings[i]
                const outOfRange =
                    i >= keymap.layers[selectedLayerIndex].bindings.length

                const holdTap = outOfRange
                    ? undefined
                    : buildHoldTapLabels(binding, behaviors, keymap)

                const children = outOfRange ? (
                    <span></span>
                ) : (
                    <HidUsageLabel
                        hid_usage={binding.param1}
                        header={
                            behaviors[binding.behaviorId]?.displayName ||
                            'Unknown'
                        }
                    />
                )
                const header = outOfRange
                    ? 'Unknown'
                    : behaviors[binding.behaviorId]?.displayName || 'Unknown'

                return {
                    id: `${keymap.layers[selectedLayerIndex].id}-${i}`,
                    header: header,
                    holdTap,
                    x: k.x / 100.0,
                    y: k.y / 100.0,
                    width: k.width / 100,
                    height: k.height / 100.0,
                    r: (k.r || 0) / 100.0,
                    rx: (k.rx || 0) / 100.0,
                    ry: (k.ry || 0) / 100.0,
                    children: children,
                }
            },
        )
    }, [layout, keymap, behaviors, selectedLayerIndex])

    if (!keymap.layers[selectedLayerIndex]) {
        return <></>
    }

    return (
        <PhysicalLayoutComp
            positions={positions}
            oneU={48}
            hoverZoom={true}
            zoom={scale}
            selectedPosition={selectedKeyPosition}
            onPositionClicked={onKeyPositionClicked}
            pressedKeys={pressedKeys}
        />
    )
}
