// pattern-check: skip macro sequence editor with per-action inline forms
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import type { KeyboardService, MacroAction } from '@firmware'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'

interface Props {
    service: KeyboardService | null
    opened: boolean
    onClose: () => void
}

const hex = (v: number): string =>
    '0x' + (v & 0xffff).toString(16).padStart(4, '0')

const parseHex = (s: string): number => {
    const v = s.startsWith('0x') ? parseInt(s.slice(2), 16) : parseInt(s, 10)
    return Number.isFinite(v) ? v & 0xffff : 0
}

function ActionRow({
    action,
    onChange,
    onRemove,
    onMoveUp,
    onMoveDown,
}: {
    action: MacroAction
    onChange: (a: MacroAction) => void
    onRemove: () => void
    onMoveUp: () => void
    onMoveDown: () => void
}): JSX.Element {
    return (
        <div className="flex items-center gap-2 border rounded p-2">
            <Select
                value={action.kind}
                onValueChange={(k) => {
                    if (k === 'tap' || k === 'down' || k === 'up') {
                        onChange({ kind: k, keycode: 0 })
                    } else if (k === 'delay') {
                        onChange({ kind: 'delay', ms: 100 })
                    } else if (k === 'text') {
                        onChange({ kind: 'text', text: '' })
                    }
                }}
            >
                <SelectTrigger className="w-24">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="tap">Tap</SelectItem>
                    <SelectItem value="down">Down</SelectItem>
                    <SelectItem value="up">Up</SelectItem>
                    <SelectItem value="delay">Delay</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                </SelectContent>
            </Select>
            {(action.kind === 'tap' ||
                action.kind === 'down' ||
                action.kind === 'up') && (
                <Input
                    value={hex(action.keycode)}
                    onChange={(e) =>
                        onChange({
                            ...action,
                            keycode: parseHex(e.target.value),
                        })
                    }
                    className="w-32 font-mono text-xs"
                    placeholder="keycode"
                />
            )}
            {action.kind === 'delay' && (
                <Input
                    type="number"
                    min={0}
                    max={0xffff}
                    value={action.ms}
                    onChange={(e) =>
                        onChange({
                            kind: 'delay',
                            ms: Math.max(
                                0,
                                Math.min(0xffff, parseInt(e.target.value) || 0),
                            ),
                        })
                    }
                    className="w-32 text-xs"
                    placeholder="ms"
                />
            )}
            {action.kind === 'text' && (
                <Input
                    value={action.text}
                    onChange={(e) =>
                        onChange({ kind: 'text', text: e.target.value })
                    }
                    className="flex-1 text-xs"
                    placeholder="ASCII text"
                />
            )}
            <Button variant="ghost" size="icon" onClick={onMoveUp}>
                <ArrowUp className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onMoveDown}>
                <ArrowDown className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onRemove}>
                <Trash2 className="h-3 w-3" />
            </Button>
        </div>
    )
}

export function MacroEditorModal({
    service,
    opened,
    onClose,
}: Props): JSX.Element | null {
    const count = service?.macros?.getCount() ?? 0
    const [idx, setIdx] = useState(0)
    const [actions, setActions] = useState<MacroAction[] | null>(null)
    const [loading, setLoading] = useState(false)

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (!service || !opened || !service.macros) return
        let cancelled = false
        setLoading(true)
        service.macros
            .getMacro(idx)
            .then((a) => {
                if (!cancelled) setActions(a)
            })
            .catch((e) => {
                console.error('Failed to load macro', e)
                toast.error('Failed to load macro')
                if (!cancelled) setActions([])
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [service, idx, opened])
    /* eslint-enable react-hooks/set-state-in-effect */

    if (!service || count === 0) return null

    const update = (i: number, a: MacroAction): void => {
        if (!actions) return
        const next = actions.slice()
        next[i] = a
        setActions(next)
    }

    const remove = (i: number): void => {
        if (!actions) return
        setActions(actions.filter((_, k) => k !== i))
    }

    const move = (i: number, delta: number): void => {
        if (!actions) return
        const j = i + delta
        if (j < 0 || j >= actions.length) return
        const next = actions.slice()
        const [item] = next.splice(i, 1)
        next.splice(j, 0, item)
        setActions(next)
    }

    const add = (): void => {
        setActions([...(actions ?? []), { kind: 'tap', keycode: 0 }])
    }

    const save = async (): Promise<void> => {
        if (!actions || !service.macros) return
        try {
            await service.macros.setMacro(idx, actions)
            toast.success(`Macro #${idx} saved`)
        } catch (e) {
            toast.error(
                'Failed to save macro: ' +
                    (e instanceof Error ? e.message : String(e)),
            )
            console.error(e)
        }
    }

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Macro Editor"
            xButton={true}
            isDismissable={true}
            showFooter={false}
            customModalBoxClass="w-[640px] max-w-[90vw]"
        >
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Label>Macro</Label>
                    <Input
                        type="number"
                        min={0}
                        max={count - 1}
                        value={idx}
                        onChange={(e) =>
                            setIdx(
                                Math.max(
                                    0,
                                    Math.min(
                                        count - 1,
                                        parseInt(e.target.value) || 0,
                                    ),
                                ),
                            )
                        }
                        className="w-20"
                    />
                    <span className="text-xs text-muted-foreground">
                        of {count}
                    </span>
                </div>
                {loading && (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                )}
                {actions && (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {actions.map((a, i) => (
                            <ActionRow
                                key={i}
                                action={a}
                                onChange={(na) => update(i, na)}
                                onRemove={() => remove(i)}
                                onMoveUp={() => move(i, -1)}
                                onMoveDown={() => move(i, 1)}
                            />
                        ))}
                        {actions.length === 0 && (
                            <p className="text-xs text-muted-foreground italic">
                                Empty macro. Add actions below.
                            </p>
                        )}
                    </div>
                )}
                <div className="flex gap-2">
                    <Button onClick={add} size="sm" variant="outline">
                        <Plus className="h-3 w-3 mr-1" /> Add action
                    </Button>
                    <Button onClick={save} size="sm" disabled={!actions}>
                        Save
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
