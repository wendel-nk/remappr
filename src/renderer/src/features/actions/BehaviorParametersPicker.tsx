// Pattern check: no GoF pattern (-) — rejected — pure picker dispatcher routes by activeSlot; no abstraction warranted.
import { BehaviorBindingParametersSet } from '@zmkfirmware/zmk-studio-ts-client/behaviors'
import { ParameterValuePicker } from './ParameterValuePicker'
import { validateValue } from '@/lib/behaviors/parameters'

export type ActiveSlot = 'param1' | 'param2'

export interface BehaviorParametersPickerProps {
    param1?: number
    param2?: number
    metadata: BehaviorBindingParametersSet[]
    layers: { id: number; name: string }[]
    activeSlot: ActiveSlot
    onParam1Changed: (value?: number) => void
    onParam2Changed: (value?: number) => void
    highlightedKeys?: number[]
    holdInvalidHint?: string
}

export const BehaviorParametersPicker = ({
    param1,
    param2,
    metadata,
    layers,
    activeSlot,
    onParam1Changed,
    onParam2Changed,
    highlightedKeys,
    holdInvalidHint,
}: BehaviorParametersPickerProps): JSX.Element => {
    const isHoldTap = (metadata[0]?.param2?.length ?? 0) > 0

    const matchedSet =
        param1 !== undefined
            ? metadata.find((s) =>
                  validateValue(
                      layers.map((l) => l.id),
                      param1,
                      s.param1,
                  ),
              )
            : undefined

    const param1Values = metadata.flatMap((m) => m.param1 ?? [])
    const param2Values = matchedSet?.param2 ?? []

    if (!isHoldTap) {
        return (
            <div className="flex flex-row flex-wrap items-center gap-2 mt-3">
                <ParameterValuePicker
                    values={param1Values}
                    value={param1}
                    layers={layers}
                    highlightedKeys={highlightedKeys}
                    onValueChanged={onParam1Changed}
                />
            </div>
        )
    }

    const activeIsParam1 = activeSlot === 'param1'
    const activeValues = activeIsParam1 ? param1Values : param2Values
    const activeValue = activeIsParam1 ? param1 : param2
    const activeForward = activeIsParam1 ? onParam1Changed : onParam2Changed

    return (
        <div className="flex flex-col gap-2 mt-3">
            {holdInvalidHint && activeSlot === 'param2' && (
                <p className="text-xs text-amber-500 italic">
                    {holdInvalidHint}
                </p>
            )}
            <div className="flex flex-row flex-wrap items-center gap-2">
                {activeValues.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                        Pick a Hold value to configure the Tap action.
                    </p>
                ) : (
                    <ParameterValuePicker
                        key={activeSlot}
                        values={activeValues}
                        value={activeValue}
                        layers={layers}
                        highlightedKeys={highlightedKeys}
                        onValueChanged={activeForward}
                    />
                )}
            </div>
        </div>
    )
}
