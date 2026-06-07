// pattern-check: skip — form tab composing primitives, mirrors sibling *Tab.tsx
import { ArrowDown, ArrowUp, Circle, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { KeyboardService, MacroAction } from '@firmware'
import { assertNever } from '@/lib/assertNever'
import { clampInt, parseIntSafe } from '@/lib/clampInt'
import { DOM_KEY_TO_HID } from '@/lib/keypress/domKeyToHidMap'
import { saveWithToast } from '@/lib/saveWithToast'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'

import { IndexInput } from '../_shared/IndexInput'
import { NumField } from '../_shared/NumField'
import { useDynamicEntry } from '../_shared/useDynamicEntry'

interface Props {
    service: KeyboardService
    opened: boolean
}

const ACTION_KINDS: ReadonlyArray<{
    value: MacroAction['kind']
    label: string
}> = [
    { value: 'tap', label: 'Tap' },
    { value: 'down', label: 'Down' },
    { value: 'up', label: 'Up' },
    { value: 'delay', label: 'Delay' },
    { value: 'text', label: 'Text' },
]

function defaultActionFor(kind: MacroAction['kind']): MacroAction {
    switch (kind) {
        case 'tap':
        case 'down':
        case 'up':
            return { kind, keycode: 0 }
        case 'delay':
            return { kind: 'delay', ms: 100 }
        case 'text':
            return { kind: 'text', text: '' }
        default:
            return assertNever(kind)
    }
}

// pattern-check: skip — thread readOnly flag to disable inputs, no abstraction
function ActionFields({
    action,
    onChange,
    readOnly = false,
}: {
    action: MacroAction
    onChange: (next: MacroAction) => void
    readOnly?: boolean
}): JSX.Element | null {
    switch (action.kind) {
        case 'tap':
        case 'down':
        case 'up':
            return (
                <NumField
                    label="Keycode"
                    value={action.keycode}
                    onChange={(v) => onChange({ ...action, keycode: v })}
                    disabled={readOnly}
                />
            )
        case 'delay':
            return (
                <Input
                    type="number"
                    min={0}
                    max={0xffff}
                    value={action.ms}
                    disabled={readOnly}
                    onChange={(e) =>
                        onChange({
                            kind: 'delay',
                            ms: clampInt(
                                parseIntSafe(e.target.value),
                                0,
                                0xffff,
                            ),
                        })
                    }
                    className="w-32 text-xs"
                    placeholder="ms"
                />
            )
        case 'text':
            return (
                <Input
                    value={action.text}
                    disabled={readOnly}
                    onChange={(e) =>
                        onChange({ kind: 'text', text: e.target.value })
                    }
                    className="flex-1 text-xs"
                    placeholder="ASCII text"
                />
            )
        default:
            return assertNever(action)
    }
}

// pattern-check: skip — readOnly flag hides edit controls, no abstraction
function ActionRow({
    action,
    onChange,
    onRemove,
    onMoveUp,
    onMoveDown,
    readOnly = false,
}: {
    action: MacroAction
    onChange: (next: MacroAction) => void
    onRemove: () => void
    onMoveUp: () => void
    onMoveDown: () => void
    readOnly?: boolean
}): JSX.Element {
    return (
        <div className="flex items-center gap-2 border rounded p-2">
            <Select
                value={action.kind}
                disabled={readOnly}
                onValueChange={(k) =>
                    onChange(defaultActionFor(k as MacroAction['kind']))
                }
            >
                <SelectTrigger className="w-24">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {ACTION_KINDS.map((k) => (
                        <SelectItem key={k.value} value={k.value}>
                            {k.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <ActionFields
                action={action}
                onChange={onChange}
                readOnly={readOnly}
            />
            {!readOnly && (
                <>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Move action up"
                        onClick={onMoveUp}
                    >
                        <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Move action down"
                        onClick={onMoveDown}
                    >
                        <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove action"
                        onClick={onRemove}
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </>
            )}
        </div>
    )
}

// pattern-check: skip — macro sequence editor body, extracted from MacroEditorModal
export function MacrosTab({ service, opened }: Props): JSX.Element | null {
    const count = service.macros?.getCount() ?? 0
    const [rawIdx, setIdx] = useState(0)
    const idx = Math.min(Math.max(0, rawIdx), Math.max(0, count - 1))

    // Editable only when the adapter is not view-only AND exposes a writer. ZMK
    // (compile-time macros) exposes `macros` with `readonly: true` and no
    // `setMacro` — the editor renders view-only. Never gate on a firmware name.
    const editable =
        !!service.macros &&
        !service.macros.readonly &&
        !!service.macros.setMacro

    const {
        entry: actions,
        setEntry: setActions,
        loading,
    } = useDynamicEntry<MacroAction[]>(
        service,
        idx,
        opened,
        (s, i) => s.macros?.getMacro(i),
        'macro',
    )

    // Record mode: while on, OS keydowns append `tap` actions (reusing the same
    // DOM-code → HID-usage map the live-view detector uses). preventDefault stops
    // the captured keys from typing elsewhere. Editing-only.
    const [recording, setRecording] = useState(false)
    useEffect(() => {
        if (!recording || !editable || !opened) return
        const onKeyDown = (e: KeyboardEvent): void => {
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
            )
                return
            const keycode = DOM_KEY_TO_HID[e.code]
            if (keycode === undefined) return
            e.preventDefault()
            setActions((prev) => [...(prev ?? []), { kind: 'tap', keycode }])
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [recording, editable, opened, setActions])

    const handleSetIdx = (n: number): void => {
        setRecording(false)
        setIdx(n)
    }

    if (count === 0) return null

    const update = (i: number, a: MacroAction): void => {
        if (!actions) return
        const next = actions.slice()
        next[i] = a
        setActions(next)
    }

    const remove = (i: number): void =>
        setActions((prev) => (prev ? prev.filter((_, k) => k !== i) : prev))

    const move = (i: number, delta: number): void => {
        if (!actions) return
        const j = i + delta
        if (j < 0 || j >= actions.length) return
        const next = actions.slice()
        const [item] = next.splice(i, 1)
        next.splice(j, 0, item)
        setActions(next)
    }

    const add = (): void =>
        setActions((prev) => [...(prev ?? []), { kind: 'tap', keycode: 0 }])

    const save = (): Promise<void> =>
        saveWithToast(
            async () => {
                if (!actions || !service.macros?.setMacro) return
                await service.macros.setMacro(idx, actions)
            },
            `Macro #${idx} saved`,
            'Failed to save macro',
        )

    return (
        <div className="space-y-3">
            {!editable && (
                <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                    This firmware doesn’t support editing macros from Remappr —
                    macros are defined at build time. Showing them read-only.
                </div>
            )}
            <IndexInput
                label="Macro"
                value={idx}
                count={count}
                onChange={handleSetIdx}
            />
            {loading && (
                <p className="text-xs text-muted-foreground">Loading…</p>
            )}
            {actions && (
                <div className="space-y-2">
                    {actions.map((a, i) => (
                        <ActionRow
                            key={i}
                            action={a}
                            onChange={(na) => update(i, na)}
                            onRemove={() => remove(i)}
                            onMoveUp={() => move(i, -1)}
                            onMoveDown={() => move(i, 1)}
                            readOnly={!editable}
                        />
                    ))}
                    {actions.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">
                            {editable
                                ? 'Empty macro. Add actions below.'
                                : 'Empty macro.'}
                        </p>
                    )}
                </div>
            )}
            {editable && (
                <div className="flex items-center gap-2">
                    <Button onClick={add} size="sm" variant="outline">
                        <Plus className="h-3 w-3 mr-1" /> Add action
                    </Button>
                    <Button
                        onClick={() => setRecording((r) => !r)}
                        size="sm"
                        variant={recording ? 'destructive' : 'outline'}
                        disabled={!actions}
                    >
                        <Circle
                            className={`h-3 w-3 mr-1 ${recording ? 'fill-current animate-pulse' : ''}`}
                        />
                        {recording ? 'Stop' : 'Record'}
                    </Button>
                    {recording && (
                        <span className="text-xs text-muted-foreground">
                            Press keys to capture…
                        </span>
                    )}
                    <Button
                        onClick={save}
                        size="sm"
                        disabled={!actions}
                        className="ml-auto"
                    >
                        Save
                    </Button>
                </div>
            )}
        </div>
    )
}
