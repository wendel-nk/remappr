import { Checkbox, CheckboxGroup } from 'react-aria-components'
import { all_mods, mod_labels } from '@/lib/keymap/keycodeGrid'

interface ModifierChipRowProps {
    selected: string[]
    onChange: (mods: string[]) => void
}

export function ModifierChipRow({
    selected,
    onChange,
}: ModifierChipRowProps): JSX.Element {
    return (
        <CheckboxGroup
            aria-label="Implicit Modifiers"
            className="grid grid-flow-col gap-x-px auto-cols-[minmax(min-content,1fr)] content-stretch divide-x rounded-md"
            value={selected}
            onChange={onChange}
        >
            {all_mods.map((m) => (
                <Checkbox
                    key={m}
                    value={m.toLocaleString()}
                    className="text-nowrap cursor-pointer grid px-2 content-center justify-center rac-selected:bg-primary border-background bg-accent hover:bg-background first:rounded-s-md last:rounded-e-md rac-selected:text-primary-foreground"
                >
                    {mod_labels[m]}
                </Checkbox>
            ))}
        </CheckboxGroup>
    )
}
