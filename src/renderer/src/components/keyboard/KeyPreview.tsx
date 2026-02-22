import { useMemo } from 'react'
import { BehaviorBinding } from '@zmkfirmware/zmk-studio-ts-client/keymap'
import { GetBehaviorDetailsResponse } from '@zmkfirmware/zmk-studio-ts-client/behaviors'
import { Key } from './Key'
import { HidUsageLabel } from './HidUsageLabel'

export interface KeyPreviewProps {
    binding: BehaviorBinding
    behaviors: GetBehaviorDetailsResponse[]
    layers?: { id: number; name: string }[]
}

/**
 * Preview component that shows how a key binding will appear on the keyboard visualization.
 * Supports both single-section (standard bindings) and two-section layouts (hold-tap bindings).
 */
export function KeyPreview({
    binding,
    behaviors,
    layers = [],
}: KeyPreviewProps): JSX.Element {
    const behavior = useMemo(
        () => behaviors.find((b) => b.id === binding.behaviorId),
        [behaviors, binding.behaviorId],
    )

    const metadata = behavior?.metadata ?? []

    // Determine if this is a hold-tap style binding (has two meaningful parameters)
    const hasSecondParam = useMemo(() => {
        if (!metadata.length) return false

        // Check if any metadata set has param2 defined
        return metadata.some((m) => m.param2 && m.param2.length > 0)
    }, [metadata])

    // Get display label for param2 (hold action for hold-tap behaviors)
    const holdActionLabel = useMemo(() => {
        if (!hasSecondParam || !binding.param2) return null

        // For layer-tap, param2 is a layer ID
        const layer = layers.find((l) => l.id === binding.param2)
        if (layer) {
            return `MO(${layer.name})`
        }

        // For other behaviors, use the behavior display name
        return behavior?.displayName ?? 'Unknown'
    }, [hasSecondParam, binding.param2, layers, behavior])

    // Get the header (behavior display name)
    const header = behavior?.displayName ?? 'Unknown'

    // Fixed preview size (matching the keyboard key 1U size)
    const previewOneU = 48

    return (
        <div className="flex flex-col items-center gap-2">
            <span className="text-sm text-muted-foreground">Preview:</span>
            <div className="relative" style={{ width: previewOneU, height: previewOneU }}>
                <Key
                    width={1}
                    height={1}
                    oneU={previewOneU}
                    hoverZoom={false}
                    header={hasSecondParam ? undefined : header}
                >
                    {hasSecondParam ? (
                        <>
                            <HidUsageLabel hid_usage={binding.param1 ?? 0} />
                            <span className="text-xs opacity-80">
                                {holdActionLabel}
                            </span>
                        </>
                    ) : (
                        <HidUsageLabel hid_usage={binding.param1 ?? 0} />
                    )}
                </Key>
            </div>
        </div>
    )
}
