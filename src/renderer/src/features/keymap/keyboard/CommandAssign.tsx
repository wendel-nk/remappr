// Pattern check: no GoF pattern (-) — rejected — cmdk command palette listing catalog
// entries grouped by page; selection delegates to the caller. Presentational, no abstraction.
import { useMemo } from 'react'
import type { CatalogEntry } from '@firmware/catalog/types'
import { useKeycodeFilter } from '@/hooks/use-keycode-filter'
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/ui/command'

interface CommandAssignProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    targetCount: number
    onSelect: (entry: CatalogEntry) => void
}

export function CommandAssign({
    open,
    onOpenChange,
    targetCount,
    onSelect,
}: CommandAssignProps): JSX.Element {
    const { pages } = useKeycodeFilter()

    // Group entries by page for the palette; skip display-only sideload tiles
    // (they can't be assigned from the picker).
    const groups = useMemo(
        () =>
            pages
                .map((p) => ({
                    id: p.id,
                    name: p.name,
                    entries: p.entries.filter((e) => !e.displayOnly),
                }))
                .filter((g) => g.entries.length > 0),
        [pages],
    )

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput
                placeholder={
                    targetCount > 1
                        ? `Assign to ${targetCount} keys…`
                        : 'Assign a key…'
                }
            />
            <CommandList>
                <CommandEmpty>No matching keycodes.</CommandEmpty>
                {groups.map((g) => (
                    <CommandGroup key={g.id} heading={g.name}>
                        {g.entries.map((entry) => (
                            <CommandItem
                                key={entry.id}
                                value={`${entry.label} ${entry.name ?? ''} ${(entry.aliases ?? []).join(' ')}`}
                                onSelect={() => {
                                    onSelect(entry)
                                    onOpenChange(false)
                                }}
                            >
                                <span className="font-medium">
                                    {entry.label}
                                </span>
                                {entry.name && entry.name !== entry.label && (
                                    <span className="ml-auto text-xs text-muted-foreground">
                                        {entry.name}
                                    </span>
                                )}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                ))}
            </CommandList>
        </CommandDialog>
    )
}
