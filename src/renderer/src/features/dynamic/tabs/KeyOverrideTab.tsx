// pattern-check: skip — form tab composing shared primitives
import { useState } from 'react'

import type {
    KeyOverrideEntry,
    KeyOverrideOptions,
    KeyboardService,
} from '@firmware'
import { Button } from '@/ui/button'
import { FieldGroup } from '@/ui/field'

import { saveWithToast } from '@/lib/saveWithToast'

import { IndexInput } from '../_shared/IndexInput'
import { NumField } from '../_shared/NumField'
import { OptionGrid, type OptionDef } from '../_shared/OptionGrid'
import { useDynamicEntry } from '../_shared/useDynamicEntry'

interface Props {
    service: KeyboardService
    count: number
    opened: boolean
}

const KEY_OVERRIDE_OPTIONS: ReadonlyArray<OptionDef<keyof KeyOverrideOptions>> =
    [
        { key: 'enabled', label: 'Enabled' },
        { key: 'activationTriggerDown', label: 'Activate on trigger down' },
        { key: 'activationRequiredModDown', label: 'Required mod down' },
        { key: 'activationNegativeModUp', label: 'Negative mod up' },
        { key: 'oneMod', label: 'One mod' },
        { key: 'noReregisterTrigger', label: 'No re-register' },
        { key: 'noUnregisterOnOtherKeyDown', label: 'No unregister on other' },
    ]

export function KeyOverrideTab({ service, count, opened }: Props): JSX.Element {
    const [rawIdx, setIdx] = useState(0)
    const idx = Math.min(Math.max(0, rawIdx), Math.max(0, count - 1))
    const { entry, setEntry, loading } = useDynamicEntry<KeyOverrideEntry>(
        service,
        idx,
        opened,
        (s, i) => s.dynamic?.getKeyOverride(i),
        'key-override',
    )

    const setOpt = (k: keyof KeyOverrideOptions, v: boolean): void => {
        if (!entry) return
        setEntry({ ...entry, options: { ...entry.options, [k]: v } })
    }

    const save = (): Promise<void> =>
        saveWithToast(
            async () => {
                if (!entry || !service.dynamic) return
                await service.dynamic.setKeyOverride(idx, entry)
            },
            `Key-override #${idx} saved`,
            'Failed to save key-override',
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
                        label="Trigger"
                        value={entry.trigger}
                        onChange={(v) => setEntry({ ...entry, trigger: v })}
                    />
                    <NumField
                        label="Replacement"
                        value={entry.replacement}
                        onChange={(v) => setEntry({ ...entry, replacement: v })}
                    />
                    <NumField
                        label="Layer mask"
                        value={entry.layers}
                        onChange={(v) => setEntry({ ...entry, layers: v })}
                    />
                    <NumField
                        label="Trigger mods"
                        value={entry.triggerMods}
                        mask={0xff}
                        onChange={(v) => setEntry({ ...entry, triggerMods: v })}
                    />
                    <NumField
                        label="Negative mods"
                        value={entry.negativeModMask}
                        mask={0xff}
                        onChange={(v) =>
                            setEntry({ ...entry, negativeModMask: v })
                        }
                    />
                    <NumField
                        label="Suppressed mods"
                        value={entry.suppressedMods}
                        mask={0xff}
                        onChange={(v) =>
                            setEntry({ ...entry, suppressedMods: v })
                        }
                    />
                    <OptionGrid
                        options={KEY_OVERRIDE_OPTIONS}
                        value={entry.options}
                        onChange={setOpt}
                    />
                    <Button onClick={save} size="sm">
                        Save
                    </Button>
                </>
            )}
        </FieldGroup>
    )
}
