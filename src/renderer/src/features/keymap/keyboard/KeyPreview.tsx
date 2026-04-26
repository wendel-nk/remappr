import { useMemo } from 'react'
import { BehaviorBinding } from '@zmkfirmware/zmk-studio-ts-client/keymap'
import { GetBehaviorDetailsResponse } from '@zmkfirmware/zmk-studio-ts-client/behaviors'
import { Key, HoldTapLabels } from './Key'
import { HidUsageLabel } from './HidUsageLabel'
import { HoldTapType, parseHoldTapBinding } from '@/lib/behaviors/holdTap'
import {
    abbreviateLayerName,
    formatMomentaryLayer,
} from '@/lib/keyAbbreviations'
import {
    hid_usage_get_labels,
    hidUsagePageAndIdFromUsage,
} from '@/lib/behaviors/hidUsages'

export interface KeyPreviewProps {
    binding: BehaviorBinding
    behaviors: GetBehaviorDetailsResponse[]
    layers?: { id: number; name: string }[]
}

const PREVIEW_ONE_U = 48

function describeUsage(usage: number): string {
    const [pageMut, id] = hidUsagePageAndIdFromUsage(usage)
    const page = pageMut & 0xff
    const labels = hid_usage_get_labels(page, id)
    const long = labels.long || labels.med || labels.short
    return long ? long.replace(/^Keyboard /, '') : `0x${usage.toString(16)}`
}

export function KeyPreview({
    binding,
    behaviors,
    layers = [],
}: KeyPreviewProps): JSX.Element {
    const behaviorMap = useMemo(
        () =>
            behaviors.reduce<Record<number, GetBehaviorDetailsResponse>>(
                (acc, b) => {
                    acc[b.id] = b
                    return acc
                },
                {},
            ),
        [behaviors],
    )

    const behavior = behaviorMap[binding.behaviorId]
    const behaviorName = behavior?.displayName ?? 'Unknown'

    const holdTap: HoldTapLabels | undefined = useMemo(() => {
        const parsed = parseHoldTapBinding(binding, behaviorMap)
        if (!parsed || !parsed.hasTapAndHold || parsed.tapParam === undefined) {
            return undefined
        }

        const tapNode = (
            <HidUsageLabel hid_usage={parsed.tapParam} header={behaviorName} />
        )
        const tapDesc = describeUsage(parsed.tapParam)

        let holdNode: React.ReactNode
        let holdDesc: string

        if (parsed.type === HoldTapType.LayerTap) {
            const layerIndex = parsed.holdParam
            const layer = layers.find((l) => l.id === layerIndex)
            const layerName = layer?.name
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
    }, [binding, behaviorMap, behaviorName, layers])

    return (
        <div className="flex flex-col items-center gap-2">
            <span className="text-sm text-muted-foreground">Preview:</span>
            <div style={{ width: PREVIEW_ONE_U, height: PREVIEW_ONE_U }}>
                <Key
                    width={1}
                    height={1}
                    oneU={PREVIEW_ONE_U}
                    hoverZoom={false}
                    header={behaviorName}
                    holdTap={holdTap}
                >
                    <HidUsageLabel hid_usage={binding.param1 ?? 0} />
                </Key>
            </div>
        </div>
    )
}
