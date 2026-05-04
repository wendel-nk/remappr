// pattern-check: skip — macro sequence editor with per-action inline switch
import {ArrowDown, ArrowUp, Plus, Trash2} from 'lucide-react'
import {useState} from 'react'

import type {KeyboardService, MacroAction} from '@firmware'
import {assertNever} from '@/lib/assertNever'
import {clampInt, parseIntSafe} from '@/lib/clampInt'
import {Button} from '@/ui/button'
import {Input} from '@/ui/input'
import {Modal} from '@/ui/modal'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'

import {saveWithToast} from '@/lib/saveWithToast'

import {IndexInput} from './_shared/IndexInput'
import {NumField} from './_shared/NumField'
import {useDynamicEntry} from './_shared/useDynamicEntry'

interface Props {
    service: KeyboardService | null
    opened: boolean
    onClose: () => void
}

const ACTION_KINDS: ReadonlyArray<{
    value: MacroAction['kind']
    label: string
}> = [
    {value: 'tap', label: 'Tap'},
    {value: 'down', label: 'Down'},
    {value: 'up', label: 'Up'},
    {value: 'delay', label: 'Delay'},
    {value: 'text', label: 'Text'},
]

function defaultActionFor ( kind: MacroAction['kind'] ): MacroAction {
    switch ( kind ) {
        case 'tap':
        case 'down':
        case 'up':
            return {kind, keycode: 0}
        case 'delay':
            return {kind: 'delay', ms: 100}
        case 'text':
            return {kind: 'text', text: ''}
        default:
            return assertNever( kind )
    }
}

function ActionFields ( {
    action,
    onChange,
}: {
    action: MacroAction
    onChange: ( next: MacroAction ) => void
} ): JSX.Element | null {
    switch ( action.kind ) {
        case 'tap':
        case 'down':
        case 'up':
            return (
                <NumField
                    label="Keycode"
                    value={action.keycode}
                    onChange={( v ) => onChange( {...action, keycode: v} )}
                />
            )
        case 'delay':
            return (
                <Input
                    type="number"
                    min={0}
                    max={0xffff}
                    value={action.ms}
                    onChange={( e ) =>
                        onChange( {
                            kind: 'delay',
                            ms: clampInt(
                                parseIntSafe( e.target.value ),
                                0,
                                0xffff,
                            ),
                        } )
                    }
                    className="w-32 text-xs"
                    placeholder="ms"
                />
            )
        case 'text':
            return (
                <Input
                    value={action.text}
                    onChange={( e ) =>
                        onChange( {kind: 'text', text: e.target.value} )
                    }
                    className="flex-1 text-xs"
                    placeholder="ASCII text"
                />
            )
        default:
            return assertNever( action )
    }
}

function ActionRow ( {
    action,
    onChange,
    onRemove,
    onMoveUp,
    onMoveDown,
}: {
    action: MacroAction
    onChange: ( next: MacroAction ) => void
    onRemove: () => void
    onMoveUp: () => void
    onMoveDown: () => void
} ): JSX.Element {
    return (
        <div className="flex items-center gap-2 border rounded p-2">
            <Select
                value={action.kind}
                onValueChange={( k ) =>
                    onChange( defaultActionFor( k as MacroAction['kind'] ) )
                }
            >
                <SelectTrigger className="w-24">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {ACTION_KINDS.map( ( k ) => (
                        <SelectItem key={k.value} value={k.value}>
                            {k.label}
                        </SelectItem>
                    ) )}
                </SelectContent>
            </Select>
            <ActionFields action={action} onChange={onChange} />
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
        </div>
    )
}

export function MacroEditorModal ( {
    service,
    opened,
    onClose,
}: Props ): JSX.Element | null {
    const count = service?.macros?.getCount() ?? 0
    const [rawIdx, setIdx] = useState( 0 )
    const idx = Math.min( Math.max( 0, rawIdx ), Math.max( 0, count - 1 ) )

    const {
        entry: actions,
        setEntry: setActions,
        loading,
    } = useDynamicEntry<MacroAction[]>(
        service,
        idx,
        opened,
        ( s, i ) => s.macros?.getMacro( i ),
        'macro',
    )

    if ( !service || count === 0 ) return null

    const update = ( i: number, a: MacroAction ): void => {
        if ( !actions ) return
        const next = actions.slice()
        next[i] = a
        setActions( next )
    }

    const remove = ( i: number ): void =>
        setActions( ( prev ) => (prev ? prev.filter( ( _, k ) => k !== i ) : prev) )

    const move = ( i: number, delta: number ): void => {
        if ( !actions ) return
        const j = i + delta
        if ( j < 0 || j >= actions.length ) return
        const next = actions.slice()
        const [item] = next.splice( i, 1 )
        next.splice( j, 0, item )
        setActions( next )
    }

    const add = (): void =>
        setActions( ( prev ) => [...(prev ?? []), {kind: 'tap', keycode: 0}] )

    const save = (): Promise<void> =>
        saveWithToast(
            async () => {
                if ( !actions || !service.macros ) return
                await service.macros.setMacro( idx, actions )
            },
            `Macro #${idx} saved`,
            'Failed to save macro',
        )

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
                <IndexInput
                    label="Macro"
                    value={idx}
                    count={count}
                    onChange={setIdx}
                />
                {loading && (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                )}
                {actions && (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {actions.map( ( a, i ) => (
                            <ActionRow
                                key={i}
                                action={a}
                                onChange={( na ) => update( i, na )}
                                onRemove={() => remove( i )}
                                onMoveUp={() => move( i, -1 )}
                                onMoveDown={() => move( i, 1 )}
                            />
                        ) )}
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
