import { BehaviorBindingParametersSet } from '@zmkfirmware/zmk-studio-ts-client/behaviors'
import { ParameterValuePicker } from './ParameterValuePicker'
import { validateValue } from './parameters'

export interface BehaviorParametersPickerProps {
    param1?: number
    param2?: number
    metadata: BehaviorBindingParametersSet[]
    layers: { id: number; name: string }[]
    onParam1Changed: (value?: number) => void
    onParam2Changed: (value?: number) => void
    onKeySelected?: (key: number | undefined) => void
    onModifiersChanged?: (modifiers: number[]) => void
}

interface SectionProps {
    label: string
    description: string
    children: React.ReactNode
}

const Section = ({
    label,
    description,
    children,
}: SectionProps): JSX.Element => (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card/50 p-3">
        <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-foreground">{label}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-row flex-wrap items-center gap-2">
            {children}
        </div>
    </div>
)

export const BehaviorParametersPicker = ({
    param1,
    param2,
    metadata,
    layers,
    onParam1Changed,
    onParam2Changed,
    onKeySelected,
    onModifiersChanged,
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

    const param1Picker = (
        <ParameterValuePicker
            values={metadata.flatMap((m) => m.param1)}
            value={param1}
            layers={layers}
            onValueChanged={onParam1Changed}
            onKeySelected={onKeySelected}
            onModifiersChanged={onModifiersChanged}
        />
    )

    const showParam2 = (matchedSet?.param2?.length || 0) > 0
    const param2Picker = showParam2 ? (
        <ParameterValuePicker
            values={matchedSet!.param2}
            value={param2}
            layers={layers}
            onValueChanged={onParam2Changed}
            onKeySelected={onKeySelected}
            onModifiersChanged={onModifiersChanged}
        />
    ) : null

    if (!isHoldTap) {
        return (
            <div className="flex flex-col gap-3 mt-3">
                <div className="flex flex-row flex-wrap items-center gap-2">
                    {param1Picker}
                </div>
                {param2Picker && (
                    <div className="flex flex-row flex-wrap items-center gap-2">
                        {param2Picker}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3 mt-3">
            <Section
                label="Hold Action"
                description="Activated when the key is held"
            >
                {param1Picker}
            </Section>
            <Section
                label="Tap Action"
                description="Activated when the key is tapped"
            >
                {param2Picker ?? (
                    <p className="text-xs text-muted-foreground italic">
                        Select a Hold Action to configure the tap key
                    </p>
                )}
            </Section>
        </div>
    )
}
