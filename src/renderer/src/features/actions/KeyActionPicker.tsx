// Pattern check: no GoF pattern (-) — rejected — picker state container over neutral KeyAction/ActionType, dispatches on slot.kind, no abstraction needed.
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ActionSlot, ActionType, KeyAction } from '@firmware/types'
import { ActionTypeSelector } from './ActionTypeSelector'
import { ActionSlotsPicker } from './ActionSlotsPicker'
import { SlotBar, type SlotDescriptor, type SlotKind } from './SlotBar'

export interface KeyActionDraft {
    kind: string
    params: number[]
}

export interface KeyActionPickerProps {
    action: KeyAction
    actionTypes: ActionType[]
    layers: { id: number; name: string }[]
    onChange: (draft: KeyActionDraft) => void
}

function slotBarKind(slot: ActionSlot | undefined): SlotKind {
    if (!slot) return 'plain'
    if (slot.kind === 'hid') return 'hid'
    if (slot.kind === 'layer') return 'layer'
    return 'plain'
}

function paramsForSlots(source: number[], slots: ActionSlot[]): number[] {
    const next: number[] = []
    for (let i = 0; i < slots.length; i++) {
        next.push(source[i] ?? 0)
    }
    return next
}

export const KeyActionPicker = ({
    action,
    actionTypes,
    layers,
    onChange,
}: KeyActionPickerProps): JSX.Element => {
    const [kind, setKind] = useState<string>(action.kind)
    const [params, setParams] = useState<number[]>([...action.params])
    const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0)

    const actionType = useMemo(
        (): ActionType | undefined => actionTypes.find((t) => t.id === kind),
        [actionTypes, kind],
    )
    const slots = useMemo<ActionSlot[]>(
        () => actionType?.slots ?? [],
        [actionType],
    )
    const isHoldTap = slots.length > 1

    useEffect((): void => {
        /* eslint-disable react-hooks/set-state-in-effect */
        setKind(action.kind)
        setParams([...action.params])
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [action])

    const dispatch = useCallback(
        (nextKind: string, nextParams: number[]): void => {
            if (
                nextKind === action.kind &&
                nextParams.length === action.params.length &&
                nextParams.every((v, i) => v === action.params[i])
            ) {
                return
            }
            onChange({ kind: nextKind, params: nextParams })
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [action, actionTypes, onChange],
    )

    const handleTypeSelected = (selectedId: string): void => {
        const target = actionTypes.find((t) => t.id === selectedId)
        const nextParams = paramsForSlots([], target?.slots ?? [])
        setKind(selectedId)
        setParams(nextParams)
        setActiveSlotIndex(0)
        dispatch(selectedId, nextParams)
    }

    const handleSlotChanged = (slotIndex: number, value?: number): void => {
        const nextParams = [...params]
        nextParams[slotIndex] = value ?? 0
        setParams(nextParams)
        dispatch(kind, nextParams)
        if (isHoldTap && value !== undefined && value !== 0) {
            setActiveSlotIndex(slotIndex === 0 ? 1 : 0)
        }
    }

    const layerNameFor = (value?: number): string | undefined => {
        if (value === undefined) return undefined
        return layers.find((l) => l.id === value)?.name
    }

    const slotBarSlots = useMemo<SlotDescriptor[]>(() => {
        if (!isHoldTap) return []
        return slots.map((slot, i) => ({
            id: String(i),
            label: slot.label,
            value: params[i],
            kind: slotBarKind(slot),
            layerName: layerNameFor(params[i]),
            inactiveBorderClass: i === 0 ? 'border-secondary' : 'border-accent',
            onRemove: (): void => {
                const next = [...params]
                next[i] = 0
                if (i === 0) {
                    for (let k = 0; k < next.length; k++) next[k] = 0
                }
                setParams(next)
                setActiveSlotIndex(0)
                dispatch(kind, next)
            },
        }))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHoldTap, slots, params, layers, kind, dispatch])

    const highlightedKeys = useMemo<number[] | undefined>(() => {
        if (!isHoldTap) return undefined
        if (slots[0]?.kind !== 'hid') return undefined
        const out: number[] = []
        if (params[0] && params[0] !== 0) out.push(params[0])
        if (params[1] && params[1] !== 0 && slots[1]?.kind === 'hid') {
            out.push(params[1])
        }
        return out
    }, [isHoldTap, slots, params])

    return (
        <div className="flex flex-col w-full gap-3">
            <div className="flex flex-row flex-wrap gap-3 items-center">
                <ActionTypeSelector
                    actionTypes={actionTypes}
                    selectedId={kind}
                    onSelect={handleTypeSelected}
                    placeholder="Select action..."
                />
                {isHoldTap && (
                    <SlotBar
                        slots={slotBarSlots}
                        activeSlotId={String(activeSlotIndex)}
                        onActivate={(id) => setActiveSlotIndex(parseInt(id))}
                    />
                )}
            </div>
            {slots.length > 0 && (
                <div className="flex-1">
                    <ActionSlotsPicker
                        slots={slots}
                        values={params}
                        layers={layers}
                        activeSlotIndex={activeSlotIndex}
                        onSlotChanged={handleSlotChanged}
                        highlightedKeys={highlightedKeys}
                    />
                </div>
            )}
        </div>
    )
}
