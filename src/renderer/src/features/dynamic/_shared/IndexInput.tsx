// pattern-check: skip — composes shadcn Input + Field primitives, no abstraction
import {useId} from 'react'

import {clampInt, parseIntSafe} from '@/lib/clampInt'
import {Field, FieldLabel} from '@/ui/field'
import {Input} from '@/ui/input'

interface Props {
    label: string
    value: number
    onChange: ( next: number ) => void
    /** Total entry count. When provided, max = count - 1 and renders "of N". */
    count?: number
    /** Hard upper bound used when no exact count is known (ARK soft cap). */
    max?: number
    min?: number
}

export function IndexInput ( {
    label,
    value,
    onChange,
    count,
    max,
    min = 0,
}: Props ): JSX.Element {
    const id = useId()
    const upper = count !== undefined ? count - 1 : (max ?? 0)
    return (
        <Field orientation="horizontal" className="gap-2">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Input
                id={id}
                type="number"
                min={min}
                max={upper}
                value={value}
                onChange={( e ) =>
                    onChange( clampInt( parseIntSafe( e.target.value ), min, upper ) )
                }
                className="w-20"
            />
            {count !== undefined && (
                <span className="text-xs text-muted-foreground">
                    of {count}
                </span>
            )}
            {count === undefined && max !== undefined && (
                <span className="text-xs text-muted-foreground">max {max}</span>
            )}
        </Field>
    )
}
