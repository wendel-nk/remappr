// pattern-check: skip — form tab composing shared primitives
import { useState } from 'react'

import type {
    AltRepeatKeyEntry,
    AltRepeatKeyOptions,
    KeyboardService,
} from '@firmware'
import { Button } from '@/ui/button'
import { FieldGroup } from '@/ui/field'

import { saveWithToast } from '@/lib/saveWithToast'

import { IndexInput } from '../_shared/IndexInput'
import { NumField } from '../_shared/NumField'
import { type OptionDef, OptionGrid } from '../_shared/OptionGrid'
import { useDynamicEntry } from '../_shared/useDynamicEntry'

interface Props {
    service: KeyboardService
    opened: boolean
}

// Vial soft cap — protocol exposes no per-firmware count for ARK.
export const ARK_MAX = 31

const ARK_OPTIONS: ReadonlyArray<OptionDef<keyof AltRepeatKeyOptions>> = [
    { key: 'enabled', label: 'Enabled' },
    { key: 'defaultToThisAltKey', label: 'Default to alt' },
    { key: 'bidirectional', label: 'Bidirectional' },
    { key: 'ignoreModHandedness', label: 'Ignore handedness' },
]

export function AltRepeatKeyTab({ service, opened }: Props): JSX.Element {
    const [idx, setIdx] = useState(0)
    const { entry, setEntry, loading } = useDynamicEntry<AltRepeatKeyEntry>(
        service,
        idx,
        opened,
        (s, i) => s.dynamic?.getAltRepeatKey?.(i),
        'alt-repeat-key',
    )

    const setOpt = (k: keyof AltRepeatKeyOptions, v: boolean): void => {
        if (!entry) return
        setEntry({ ...entry, options: { ...entry.options, [k]: v } })
    }

    const save = (): Promise<void> =>
        saveWithToast(
            async () => {
                if (!entry || !service.dynamic?.setAltRepeatKey) return
                await service.dynamic.setAltRepeatKey(idx, entry)
            },
            `Alt-repeat-key #${idx} saved`,
            'Failed to save alt-repeat-key',
        )

    return (
        <FieldGroup className="space-y-3">
            <IndexInput
                label="Index"
                value={idx}
                max={ARK_MAX}
                onChange={setIdx}
            />
            {loading && (
                <p className="text-xs text-muted-foreground">Loading…</p>
            )}
            {entry && (
                <>
                    <NumField
                        label="Keycode"
                        value={entry.keycode}
                        onChange={(v) => setEntry({ ...entry, keycode: v })}
                    />
                    <NumField
                        label="Alt keycode"
                        value={entry.altKeycode}
                        onChange={(v) => setEntry({ ...entry, altKeycode: v })}
                    />
                    <NumField
                        label="Allowed mods"
                        value={entry.allowedMods}
                        mask={0xff}
                        onChange={(v) => setEntry({ ...entry, allowedMods: v })}
                    />
                    <OptionGrid
                        options={ARK_OPTIONS}
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
