// pattern-check: skip — form tab composing shared primitives
import { useState } from 'react'

import type { KeyboardService, TapDanceEntry } from '@firmware'
import { Button } from '@/ui/button'
import { FieldGroup } from '@/ui/field'

import { saveWithToast } from '@/lib/saveWithToast'

import { IndexInput } from '../_shared/IndexInput'
import { NumField } from '../_shared/NumField'
import { useDynamicEntry } from '../_shared/useDynamicEntry'

// pattern-check: skip optional defaultIndex prop add to existing component — mechanical extension
interface Props {
    service: KeyboardService
    count: number
    opened: boolean
    defaultIndex?: number
}

// pattern-check: skip optional defaultIndex prop add to existing component — mechanical extension
export function TapDanceTab({
    service,
    count,
    opened,
    defaultIndex,
}: Props): JSX.Element {
    const [rawIdx, setIdx] = useState(defaultIndex ?? 0)
    const idx = Math.min(Math.max(0, rawIdx), Math.max(0, count - 1))
    const { entry, setEntry, loading } = useDynamicEntry<TapDanceEntry>(
        service,
        idx,
        opened,
        (s, i) => s.dynamic?.getTapDance(i),
        'tap-dance',
    )

    const save = (): Promise<void> =>
        saveWithToast(
            async () => {
                if (!entry || !service.dynamic) return
                await service.dynamic.setTapDance(idx, entry)
            },
            `Tap-dance #${idx} saved`,
            'Failed to save tap-dance',
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
                    <NumField
                        label="On Tap"
                        value={entry.onTap}
                        onChange={(v) => setEntry({ ...entry, onTap: v })}
                    />
                    <NumField
                        label="On Hold"
                        value={entry.onHold}
                        onChange={(v) => setEntry({ ...entry, onHold: v })}
                    />
                    <NumField
                        label="On Double"
                        value={entry.onDoubleTap}
                        onChange={(v) => setEntry({ ...entry, onDoubleTap: v })}
                    />
                    <NumField
                        label="On Tap-Hold"
                        value={entry.onTapHold}
                        onChange={(v) => setEntry({ ...entry, onTapHold: v })}
                    />
                    <NumField
                        label="Term (ms)"
                        value={entry.tappingTerm}
                        onChange={(v) => setEntry({ ...entry, tappingTerm: v })}
                    />
                    <Button onClick={save} size="sm">
                        Save
                    </Button>
                </>
            )}
        </FieldGroup>
    )
}
