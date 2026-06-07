// pattern-check: skip — composes shadcn Input + Field primitives, no abstraction
import { useId } from 'react'

import { hex16, parseHex16 } from '@/lib/hex'
import { Field, FieldLabel } from '@/ui/field'
import { Input } from '@/ui/input'

interface Props {
    label: string
    value: number
    onChange: (next: number) => void
    /** Optional bitmask applied after parse (e.g. 0xff for byte fields). */
    mask?: number
    disabled?: boolean
}

export function NumField({
    label,
    value,
    onChange,
    mask,
    disabled = false,
}: Props): JSX.Element {
    const id = useId()
    return (
        <Field orientation="horizontal" className="gap-2">
            <FieldLabel htmlFor={id} className="w-28 text-xs font-normal">
                {label}
            </FieldLabel>
            <Input
                id={id}
                value={hex16(value)}
                disabled={disabled}
                onChange={(e) => {
                    const v = parseHex16(e.target.value)
                    onChange(mask !== undefined ? v & mask : v)
                }}
                className="w-32 font-mono text-xs"
            />
        </Field>
    )
}
