// pattern-check: skip — form tab composing shared primitives
import { useState } from 'react'

import type { ComboEntry, KeyboardService } from '@firmware'
import { Button } from '@/ui/button'
import { FieldGroup } from '@/ui/field'

import { saveWithToast } from '@/lib/saveWithToast'

import { IndexInput } from '../_shared/IndexInput'
import { NumField } from '../_shared/NumField'
import { useDynamicEntry } from '../_shared/useDynamicEntry'

interface Props {
    service: KeyboardService
    count: number
    opened: boolean
}

export function ComboTab({ service, count, opened }: Props): JSX.Element {
    const [rawIdx, setIdx] = useState(0)
    const idx = Math.min(Math.max(0, rawIdx), Math.max(0, count - 1))
    const { entry, setEntry, loading } = useDynamicEntry<ComboEntry>(
        service,
        idx,
        opened,
        (s, i) => s.dynamic?.getCombo(i),
        'combo',
    )

    const setKey = (i: 0 | 1 | 2 | 3, v: number): void => {
        if (!entry) return
        const keys: ComboEntry['keys'] = [...entry.keys]
        keys[i] = v
        setEntry({ ...entry, keys })
    }

    const save = (): Promise<void> =>
        saveWithToast(
            async () => {
                if (!entry || !service.dynamic) return
                await service.dynamic.setCombo(idx, entry)
            },
            `Combo #${idx} saved`,
            'Failed to save combo',
        )

    return (
        <FieldGroup className="space-y-3">
            <IndexInput
                label="Index"
                value={idx}
                count={count}
                onChange={setIdx}
            />
            {loading && (
                <p className="text-xs text-muted-foreground">Loading…</p>
            )}
            {entry && (
                <>
                    {entry.keys.map((k, i) => (
                        <NumField
                            key={i}
                            label={`Key ${i + 1}`}
                            value={k}
                            onChange={(v) => setKey(i as 0 | 1 | 2 | 3, v)}
                        />
                    ))}
                    <NumField
                        label="Output"
                        value={entry.output}
                        onChange={(v) => setEntry({ ...entry, output: v })}
                    />
                    <Button onClick={save} size="sm">
                        Save
                    </Button>
                </>
            )}
        </FieldGroup>
    )
}
