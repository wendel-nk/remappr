// pattern-check: skip — composes shadcn Checkbox + Field primitives, no abstraction
import {useId} from 'react'

import {Checkbox} from '@/ui/checkbox'
import {Field, FieldLabel} from '@/ui/field'

interface Props {
    label: string
    value: boolean
    onChange: ( next: boolean ) => void
}

export function CheckField ( {label, value, onChange}: Props ): JSX.Element {
    const id = useId()
    return (
        <Field orientation="horizontal" className="gap-2">
            <Checkbox
                id={id}
                checked={value}
                onCheckedChange={( v ) => onChange( v === true )}
            />
            <FieldLabel htmlFor={id} className="text-xs font-normal">
                {label}
            </FieldLabel>
        </Field>
    )
}
