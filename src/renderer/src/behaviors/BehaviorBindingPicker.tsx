/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react'

import {
    GetBehaviorDetailsResponse,
    BehaviorBindingParametersSet,
} from '@zmkfirmware/zmk-studio-ts-client/behaviors'
import { BehaviorBinding } from '@zmkfirmware/zmk-studio-ts-client/keymap'
import { BehaviorParametersPicker } from './BehaviorParametersPicker'
import { BehaviorSelector } from './BehaviorSelector'
import { validateValue } from './parameters'

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

    const metadata = useMemo(
        (): GetBehaviorDetailsResponse['metadata'] =>
            behaviors.find((b): boolean => b.id == behaviorId)?.metadata ?? [],
        [behaviorId, behaviors],
    )

    useEffect((): void => {
        if (!binding) {
            return
        }

        if (
            binding.behaviorId === behaviorId &&
            binding.param1 === param1 &&
            binding.param2 === param2
        ) {
            return
        }

        if (!metadata) {
            console.error(
                "Can't find metadata for the selected behaviorId",
                behaviorId,
            )
            return
        }

        if (
            validateBinding(
                metadata,
                layers.map(({ id }: { id: number }): number => id),
                param1,
                param2,
            )
        ) {
            onBindingChanged({
                behaviorId,
                param1: param1 || 0,
                param2: param2 || 0,
            })
        }
    }, [
        behaviorId,
        param1,
        param2,
        binding,
        metadata,
        layers,
        onBindingChanged,
    ])

    useEffect((): void => {
        if (!binding) {
            return
        }
        setBehaviorId(binding.behaviorId)
        setParam1(binding.param1)
        setParam2(binding.param2)
    }, [binding])

    const handleBehaviorSelected = (selectedBehaviorId: number): void => {
        setBehaviorId(selectedBehaviorId)
        setParam1(0)
        setParam2(0)
    }

    return (
        <div className="flex flex-col w-full gap-3">
            <BehaviorSelector
                behaviors={behaviors}
                selectedBehaviorId={behaviorId}
                onBehaviorSelected={handleBehaviorSelected}
                placeholder="Select behavior..."
            />
            {metadata && (
                <BehaviorParametersPicker
                    metadata={metadata}
                    param1={param1}
                    param2={param2}
                    layers={layers}
                    onParam1Changed={setParam1}
                    onParam2Changed={setParam2}
                />
            )}
        </div>
    )
}
