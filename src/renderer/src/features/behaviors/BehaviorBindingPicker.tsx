import { useCallback, useEffect, useMemo, useState } from 'react'

import {
    GetBehaviorDetailsResponse,
    BehaviorBindingParametersSet,
} from '@zmkfirmware/zmk-studio-ts-client/behaviors'
import { BehaviorBinding } from '@zmkfirmware/zmk-studio-ts-client/keymap'
import { BehaviorParametersPicker } from './BehaviorParametersPicker'
import { BehaviorSelector } from './BehaviorSelector'
import { validateValue } from '@/lib/behaviors/parameters'
import { SelectedKeysDisplay } from '@/features/keymap/keycodes/SelectedKeysDisplay'
import { KeyPreview } from '@/features/keymap/keyboard/KeyPreview'

// Modifier key definitions (same as HidUsagePicker)
enum Mods {
    LeftControl = 0x01,
    LeftShift = 0x02,
    LeftAlt = 0x04,
    LeftGUI = 0x08,
    RightControl = 0x10,
    RightShift = 0x20,
    RightAlt = 0x40,
    RightGUI = 0x80,
}

// Map keyboard IDs to modifier flags
const KEY_ID_TO_MOD: Record<number, Mods> = {
    224: Mods.LeftControl, // Keyboard LeftControl
    225: Mods.LeftShift, // Keyboard LeftShift
    226: Mods.LeftAlt, // Keyboard LeftAlt
    227: Mods.LeftGUI, // Keyboard Left GUI
    228: Mods.RightControl, // Keyboard RightControl
    229: Mods.RightShift, // Keyboard RightShift
    230: Mods.RightAlt, // Keyboard RightAlt
    231: Mods.RightGUI, // Keyboard Right GUI
}

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

export const BehaviorBindingPicker = ({
    binding,
    layers,
    behaviors,
    onBindingChanged,
}: BehaviorBindingPickerProps): JSX.Element => {
    const [behaviorId, setBehaviorId] = useState(binding?.behaviorId ?? 0)
    const [param1, setParam1] = useState<number | undefined>(binding?.param1)
    const [param2, setParam2] = useState<number | undefined>(binding?.param2)

    const [selectedKey, setSelectedKey] = useState<number | undefined>(
        undefined,
    )
    const [selectedModifiers, setSelectedModifiers] = useState<Mods[]>([])

    const metadata = useMemo(
        (): GetBehaviorDetailsResponse['metadata'] =>
            behaviors.find((b): boolean => b.id == behaviorId)?.metadata ?? [],
        [behaviorId, behaviors],
    )

    const isKeysLayoutActive = useMemo((): boolean => {
        if (!metadata.length) return false
        const allValues = metadata.flatMap((m) => [
            ...(m.param1 ?? []),
            ...(m.param2 ?? []),
        ])
        return allValues.some((v) => v.hidUsage !== undefined)
    }, [metadata])

    // Sync local edit state when binding prop changes from outside (e.g. undo/redo).
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
        dispatchIfValid({
            behaviorId: selectedBehaviorId,
            param1: 0,
            param2: 0,
        })
    }

    const handleParam1Changed = (value?: number): void => {
        setParam1(value)
        dispatchIfValid({ behaviorId, param1: value, param2 })
    }

    const handleParam2Changed = (value?: number): void => {
        setParam2(value)
        dispatchIfValid({ behaviorId, param1, param2: value })
    }

    const handleClearAll = (): void => {
        setSelectedKey(undefined)
        setSelectedModifiers([])
    }

    const handleRemoveKey = (): void => {
        setSelectedKey(undefined)
    }

    const handleRemoveModifier = (keyId: number): void => {
        const modifier = KEY_ID_TO_MOD[keyId]
        if (modifier) {
            setSelectedModifiers((prev: Mods[]): Mods[] =>
                prev.filter((m: Mods): boolean => m !== modifier),
            )
        }
    }

    const handleKeySelected = (key: number | undefined): void => {
        setSelectedKey(key)
    }

    const handleModifiersChanged = (modifiers: number[]): void => {
        setSelectedModifiers(modifiers)
    }

    const liveBinding: BehaviorBinding = useMemo(
        () => ({
            behaviorId,
            param1: param1 ?? 0,
            param2: param2 ?? 0,
        }),
        [behaviorId, param1, param2],
    )

    return (
        <div className="flex flex-row w-full gap-4">
            <div className="flex-shrink-0">
                <KeyPreview
                    binding={liveBinding}
                    behaviors={behaviors}
                    layers={layers}
                />
            </div>

            <div className="flex flex-col flex-1">
                <div className="flex flex-row flex-1 gap-3 items-start">
                    <BehaviorSelector
                        behaviors={behaviors}
                        selectedBehaviorId={behaviorId}
                        onBehaviorSelected={handleBehaviorSelected}
                        placeholder="Select behavior..."
                    />
                    {isKeysLayoutActive && (
                        <SelectedKeysDisplay
                            selectedKey={selectedKey}
                            selectedModifiers={selectedModifiers}
                            onClearAll={handleClearAll}
                            onRemoveKey={handleRemoveKey}
                            onRemoveModifier={handleRemoveModifier}
                        />
                    )}
                </div>
                {metadata && (
                    <div className="flex-1">
                        <BehaviorParametersPicker
                            metadata={metadata}
                            param1={param1}
                            param2={param2}
                            layers={layers}
                            onParam1Changed={handleParam1Changed}
                            onParam2Changed={handleParam2Changed}
                            onKeySelected={handleKeySelected}
                            onModifiersChanged={handleModifiersChanged}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
