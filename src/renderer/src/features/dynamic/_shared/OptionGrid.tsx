// pattern-check: skip — declarative checkbox-grid renderer, generic over options shape
import {CheckField} from './CheckField'

export interface OptionDef<K extends string> {
    key: K
    label: string
}

interface Props<K extends string> {
    options: ReadonlyArray<OptionDef<K>>
    value: Record<K, boolean>
    onChange: ( key: K, next: boolean ) => void
    columns?: 1 | 2 | 3
}

export function OptionGrid<K extends string> ( {
    options,
    value,
    onChange,
    columns = 2,
}: Props<K> ): JSX.Element {
    const cols =
        columns === 1
            ? 'grid-cols-1'
            : columns === 3
                ? 'grid-cols-3'
                : 'grid-cols-2'
    return (
        <div className={`grid ${cols} gap-1 mt-2`}>
            {options.map( ( opt ) => (
                <CheckField
                    key={opt.key}
                    label={opt.label}
                    value={value[opt.key]}
                    onChange={( v ) => onChange( opt.key, v )}
                />
            ) )}
        </div>
    )
}
