// pattern-check: skip — readOnly flag hides edit controls, no abstraction
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'

import type { MacroAction } from '@firmware'
import { Button } from '@/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'

import { MacroActionFields } from './MacroActionFields'

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

// Default action per kind. A Record (vs a switch) keeps exhaustiveness — a new
// MacroAction kind is a compile error here — and reads as a table. Each entry is
// a factory so every call returns a fresh object.
const DEFAULT_ACTION: Record<MacroAction['kind'], () => MacroAction> = {
    tap: () => ({ kind: 'tap', keycode: 0 }),
    down: () => ({ kind: 'down', keycode: 0 }),
    up: () => ({ kind: 'up', keycode: 0 }),
    delay: () => ({ kind: 'delay', ms: 100 }),
    text: () => ({ kind: 'text', text: '' }),
}

function defaultActionFor(kind: MacroAction['kind']): MacroAction {
    return DEFAULT_ACTION[kind]()
}

export function MacroActionRow({
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
            <MacroActionFields
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
