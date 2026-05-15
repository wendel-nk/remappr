// Pattern check: no GoF pattern (-) — rejected — file-picker action mirroring LayoutSideloadAction shape; reads a .keymap file, runs the parser, materialises display-only catalog entries. Pure UI glue, no abstractions.
// pattern-check: skip — file-picker UI glue around parseZmkCombos
import { useCallback, useRef } from 'react'
import { Network } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import type { CatalogEntry } from '@firmware/catalog/types'
import { parseZmkCombos, type ParsedCombo } from '@firmware/zmk/parseCombos'
import useDynamicCatalogStore from '@/stores/dynamicCatalogStore'

const HID_KIND: CatalogEntry['kinds'] = ['hid']

const labelFor = (combo: ParsedCombo): string => {
    const stripped = combo.name.replace(/^combo[_-]?/i, '')
    return stripped || combo.name
}

const noteFor = (combo: ParsedCombo): string => {
    const positions = combo.keyPositions.join(' + ')
    const layers = combo.layers ? ` · layers ${combo.layers.join(', ')}` : ''
    const timeout = combo.timeoutMs ? ` · ${combo.timeoutMs}ms` : ''
    return `keys ${positions} → ${combo.bindings}${layers}${timeout}`
}

const toCatalogEntry = (combo: ParsedCombo): CatalogEntry => ({
    id: `combo.sideload.${combo.name}`,
    label: labelFor(combo),
    name: combo.name,
    notes: noteFor(combo),
    kinds: HID_KIND,
    displayOnly: true,
})

export function ZmkComboSideloadAction(): JSX.Element {
    const setEntries = useDynamicCatalogStore(
        (s) => s.setSideloadedComboEntries,
    )
    const inputRef = useRef<HTMLInputElement | null>(null)

    const onPick = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            try {
                const text = await file.text()
                const combos = parseZmkCombos(text)
                if (combos.length === 0) {
                    toast.warning(
                        'No `combos { … }` block found in the uploaded file.',
                    )
                    setEntries([])
                    return
                }
                setEntries(combos.map(toCatalogEntry))
                toast.success(
                    `Loaded ${combos.length} combo${combos.length === 1 ? '' : 's'} from ${file.name}`,
                )
            } catch (err) {
                console.error('parseZmkCombos failed', err)
                toast.error('Failed to parse .keymap file')
            }
        },
        [setEntries],
    )

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept=".keymap,.dts,.dtsi,text/plain"
                hidden
                onChange={onPick}
            />
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(): void => inputRef.current?.click()}
                    >
                        <Network aria-label="Import ZMK combos from .keymap" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Import ZMK combos (.keymap)</p>
                </TooltipContent>
            </Tooltip>
        </>
    )
}
