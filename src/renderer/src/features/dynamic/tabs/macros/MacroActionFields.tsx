// pattern-check: skip — thread readOnly flag to disable inputs, no abstraction
import type { MacroAction } from '@firmware'
import { assertNever } from '@/lib/assertNever'
import { clampInt, parseIntSafe } from '@/lib/clampInt'
import { Input } from '@/ui/input'

import { NumField } from '../../_shared/NumField'

export function MacroActionFields({
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
