// pattern-check: skip — generic hex-bytes textarea editor
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/ui/button'

import { bytesToHex, hexToBytes } from './hsv'

interface Props {
    label: string
    bytes: Uint8Array
    onChange: (next: Uint8Array) => void
    onWrite: () => void | Promise<void>
    onReload: () => void | Promise<void>
}

export function BytesEditor({
    label,
    bytes,
    onChange,
    onWrite,
    onReload,
}: Props): JSX.Element {
    const hexText = useMemo(() => bytesToHex(bytes), [bytes])
    const [draft, setDraft] = useState(hexText)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        /* eslint-disable react-hooks/set-state-in-effect */
        setDraft(hexText)
        setError(null)
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [hexText])

    const apply = (): boolean => {
        const parsed = hexToBytes(draft)
        if (!parsed) {
            setError('Invalid hex bytes (use space-separated 00..ff)')
            return false
        }
        setError(null)
        onChange(parsed)
        return true
    }

    return (
        <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{label}</h3>
            <div className="text-xs text-muted-foreground">
                Payload shape varies per board. Edit raw bytes, apply, then
                write.
            </div>
            <textarea
                value={draft}
                onChange={(e): void => setDraft(e.currentTarget.value)}
                onBlur={apply}
                aria-invalid={error !== null}
                aria-describedby={error ? `${label}-err` : undefined}
                className="min-h-24 w-full rounded border bg-transparent p-2 font-mono text-xs"
                spellCheck={false}
            />
            {error && (
                <div id={`${label}-err`} className="text-xs text-destructive">
                    {error}
                </div>
            )}
            <div className="flex gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={(): void => {
                        void onReload()
                    }}
                >
                    Reload
                </Button>
                <Button
                    size="sm"
                    onClick={(): void => {
                        if (apply()) void onWrite()
                    }}
                >
                    Write
                </Button>
            </div>
        </div>
    )
}
