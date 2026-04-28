// Pattern check: no GoF pattern (-) — rejected — inlines slot bar with selector, auto-advance, multi-key cluster; no GoF abstraction warranted.
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
    GetBehaviorDetailsResponse,
    BehaviorBindingParametersSet,
} from '@zmkfirmware/zmk-studio-ts-client/behaviors'
import { BehaviorBinding } from '@zmkfirmware/zmk-studio-ts-client/keymap'
import {
    BehaviorParametersPicker,
    type ActiveSlot,
} from './BehaviorParametersPicker'
import { BehaviorSelector } from './BehaviorSelector'
import { SlotBar, type SlotDescriptor, type SlotKind } from './SlotBar'
import { Button } from '@/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { validateValue } from '@/lib/behaviors/parameters'
import { maskMods } from '@/lib/keymap/keycodeGrid'

export interface BehaviorBindingPickerProps {
    binding: BehaviorBinding
    behaviors: GetBehaviorDetailsResponse[]
    layers: { id: number; name: string }[]
    onBindingChanged: (binding: BehaviorBinding) => void
}

function validateBinding(
    metadata: BehaviorBindingParametersSet[],
    layerIds: number[],
    param1?: number,
    param2?: number,
): boolean {
    if (
        (param1 === undefined || param1 === 0) &&
        metadata.every((s) => !s.param1 || s.param1.length === 0)
    ) {
        return true
    }

    const matchingSet = metadata.find((s) =>
        validateValue(layerIds, param1, s.param1),
    )

    if (!matchingSet) {
        return false
    }

    return validateValue(layerIds, param2, matchingSet.param2)
}

function descriptorKind(
    value:
        | {
              hidUsage?: unknown
              layerId?: unknown
          }
        | undefined,
): SlotKind {
    if (!value) return 'plain'
    if (value.hidUsage) return 'hidUsage'
    if (value.layerId) return 'layer'
    return 'plain'
}

export const BehaviorBindingPicker = ({
    binding,
    layers,
    behaviors,
    onBindingChanged,
}: BehaviorBindingPickerProps): JSX.Element => {
    const [behaviorId, setBehaviorId] = useState(binding?.behaviorId ?? 0)
    const [param1, setParam1] = useState<number | undefined>(binding?.param1)
    const [param2, setParam2] = useState<number | undefined>(binding?.param2)
    const [activeSlot, setActiveSlot] = useState<ActiveSlot>('param1')
    const [multiKeyMode, setMultiKeyMode] = useState(false)
    const [multiKeys, setMultiKeys] = useState<number[]>([])

    const metadata = useMemo(
        (): GetBehaviorDetailsResponse['metadata'] =>
            behaviors.find((b): boolean => b.id == behaviorId)?.metadata ?? [],
        [behaviorId, behaviors],
    )

    const matchedSet = useMemo(
        () =>
            param1 !== undefined
                ? metadata.find((s) =>
                      validateValue(
                          layers.map((l) => l.id),
                          param1,
                          s.param1,
                      ),
                  )
                : undefined,
        [metadata, layers, param1],
    )

    const isHoldTap = (metadata[0]?.param2?.length ?? 0) > 0
    const param1Descriptor = metadata[0]?.param1?.[0]
    const param2Descriptor = matchedSet?.param2?.[0]
    const param1Kind = descriptorKind(param1Descriptor)
    const param2Kind = descriptorKind(param2Descriptor)
    const isParam1HidUsage = param1Kind === 'hidUsage'

    const holdInvalidHint =
        isHoldTap && param2 !== undefined && param2 !== 0 && !matchedSet
            ? 'Pick a Hold value — the Tap binding will be sent once Hold is valid.'
            : undefined

    useEffect((): void => {
        if (!binding) {
            return
        }
        /* eslint-disable react-hooks/set-state-in-effect */
        setBehaviorId(binding.behaviorId)
        setParam1(binding.param1)
        setParam2(binding.param2)
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [binding])

    const dispatchIfValid = useCallback(
        (next: {
            behaviorId: number
            param1?: number
            param2?: number
        }): void => {
            const candidateMeta =
                next.behaviorId === behaviorId
                    ? metadata
                    : (behaviors.find((b) => b.id === next.behaviorId)
                          ?.metadata ?? [])
            if (!candidateMeta.length) return
            if (
                !validateBinding(
                    candidateMeta,
                    layers.map((l) => l.id),
                    next.param1,
                    next.param2,
                )
            ) {
                return
            }
            const nextBinding: BehaviorBinding = {
                behaviorId: next.behaviorId,
                param1: next.param1 || 0,
                param2: next.param2 || 0,
            }
            if (
                binding &&
                binding.behaviorId === nextBinding.behaviorId &&
                binding.param1 === nextBinding.param1 &&
                binding.param2 === nextBinding.param2
            ) {
                return
            }
            onBindingChanged(nextBinding)
        },
        [behaviorId, behaviors, binding, layers, metadata, onBindingChanged],
    )

    const handleBehaviorSelected = (selectedBehaviorId: number): void => {
        setBehaviorId(selectedBehaviorId)
        setParam1(0)
        setParam2(0)
        setActiveSlot('param1')
        setMultiKeyMode(false)
        setMultiKeys([])
        dispatchIfValid({
            behaviorId: selectedBehaviorId,
            param1: 0,
            param2: 0,
        })
    }

    const handleParam1Changed = (value?: number): void => {
        setParam1(value)
        dispatchIfValid({ behaviorId, param1: value, param2 })
        if (isHoldTap && value !== undefined && value !== 0) {
            setActiveSlot('param2')
        }
        if (!isHoldTap && multiKeyMode && value !== undefined && value !== 0) {
            const base = maskMods(value)
            if (base !== 0) {
                setMultiKeys((prev) =>
                    prev.includes(base)
                        ? prev.filter((k) => k !== base)
                        : [...prev, base],
                )
            }
        }
    }

    const handleParam2Changed = (value?: number): void => {
        setParam2(value)
        dispatchIfValid({ behaviorId, param1, param2: value })
        if (isHoldTap && value !== undefined && value !== 0) {
            setActiveSlot('param1')
        }
    }

    const handleMultiKeyToggle = useCallback((on: boolean): void => {
        setMultiKeyMode(on)
        if (!on) setMultiKeys([])
    }, [])

    const handleClearMultiKeys = useCallback((): void => {
        setMultiKeys([])
    }, [])

    const layerNameFor = (value?: number): string | undefined => {
        if (value === undefined) return undefined
        return layers.find((l) => l.id === value)?.name
    }

    const holdTapSlots = useMemo<SlotDescriptor[]>(() => {
        if (!isHoldTap) return []
        return [
            {
                id: 'param1',
                label: param1Descriptor?.name?.toString() ?? 'Hold',
                value: param1,
                kind: param1Kind,
                layerName: layerNameFor(param1),
                inactiveBorderClass: 'border-secondary',
                onRemove: () => {
                    setParam1(0)
                    setParam2(0)
                    setActiveSlot('param1')
                    dispatchIfValid({ behaviorId, param1: 0, param2: 0 })
                },
            },
            {
                id: 'param2',
                label: param2Descriptor?.name?.toString() ?? 'Tap',
                value: param2,
                kind: param2Kind,
                layerName: layerNameFor(param2),
                inactiveBorderClass: 'border-accent',
                disabled: !matchedSet,
                disabledHint: 'Pick a Hold value first',
                onRemove: () => {
                    setParam2(0)
                    dispatchIfValid({ behaviorId, param1, param2: 0 })
                },
            },
        ]
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isHoldTap,
        param1,
        param2,
        param1Descriptor,
        param2Descriptor,
        param1Kind,
        param2Kind,
        matchedSet,
        layers,
        behaviorId,
        dispatchIfValid,
    ])

    const multiKeySlots = useMemo<SlotDescriptor[]>(
        () =>
            multiKeys.map((k, idx) => ({
                id: `mk-${k}-${idx}`,
                label: `Key ${idx + 1}`,
                value: k,
                kind: 'hidUsage' as SlotKind,
                inactiveBorderClass: 'border-secondary',
                onRemove: () =>
                    setMultiKeys((prev) => prev.filter((x) => x !== k)),
            })),
        [multiKeys],
    )

    const highlightedKeys = useMemo<number[] | undefined>(() => {
        if (isHoldTap && isParam1HidUsage) {
            const out: number[] = []
            if (param1 !== undefined && param1 !== 0) out.push(param1)
            if (
                param2 !== undefined &&
                param2 !== 0 &&
                param2Kind === 'hidUsage'
            ) {
                out.push(param2)
            }
            return out
        }
        return undefined
    }, [isHoldTap, isParam1HidUsage, param1, param2, param2Kind])

    const showMultiKeyControls = !isHoldTap && isParam1HidUsage

    return (
        <div className="flex flex-col w-full gap-3">
            <div className="flex flex-row flex-wrap gap-3 items-center">
                <BehaviorSelector
                    behaviors={behaviors}
                    selectedBehaviorId={behaviorId}
                    onBehaviorSelected={handleBehaviorSelected}
                    placeholder="Select behavior..."
                />
                {isHoldTap && (
                    <SlotBar
                        slots={holdTapSlots}
                        activeSlotId={activeSlot}
                        onActivate={(id) => setActiveSlot(id as ActiveSlot)}
                    />
                )}
                {showMultiKeyControls && (
                    <>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    variant={
                                        multiKeyMode ? 'default' : 'outline'
                                    }
                                    size="sm"
                                    onClick={() =>
                                        handleMultiKeyToggle(!multiKeyMode)
                                    }
                                    aria-pressed={multiKeyMode}
                                >
                                    Multi-key: {multiKeyMode ? 'On' : 'Off'}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                ZMK &kp accepts one key per binding — multi-key
                                requires a firmware-defined macro. Chips are
                                visual only; firmware receives last-clicked.
                            </TooltipContent>
                        </Tooltip>
                        {multiKeyMode && multiKeys.length > 0 && (
                            <>
                                <SlotBar slots={multiKeySlots} />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClearMultiKeys}
                                >
                                    Clear all
                                </Button>
                            </>
                        )}
                    </>
                )}
            </div>
            {metadata && (
                <div className="flex-1">
                    <BehaviorParametersPicker
                        metadata={metadata}
                        param1={param1}
                        param2={param2}
                        layers={layers}
                        activeSlot={activeSlot}
                        onParam1Changed={handleParam1Changed}
                        onParam2Changed={handleParam2Changed}
                        highlightedKeys={highlightedKeys}
                        holdInvalidHint={holdInvalidHint}
                    />
                </div>
            )}
        </div>
    )
}
