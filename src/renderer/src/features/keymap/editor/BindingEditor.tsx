// pattern-check: skip mechanical port — bridges neutral KeyAction store with ZMK BehaviorBinding picker; calls service.setKey
import { X } from 'lucide-react'
import { BehaviorBindingPicker } from '@/features/actions/BehaviorBindingPicker'
import { useBehaviors } from '@/hooks/use-behaviors'
import type { BehaviorBinding } from '@zmkfirmware/zmk-studio-ts-client/keymap'
import { useCallback, useMemo } from 'react'
import undoRedoStore from '@/stores/undoRedoStore'
import useConnectionStore from '@/stores/connectionStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import { produce } from 'immer'
import type { KeyAction, Keymap } from '@firmware/types'
import {
    bindingToKeyAction,
    type ZmkBindingParams,
} from '@firmware/zmk/actions'
import { Card, CardContent } from '@/ui/card'
import { Button } from '@/ui/button'
import { toast } from 'sonner'

interface BindingEditorProps {
    keymap: Keymap | undefined
    setKeymap: (
        keymap:
            | Keymap
            | undefined
            | ((prev: Keymap | undefined) => Keymap | undefined),
    ) => void
    selectedKeyPosition: number | undefined
    setSelectedKeyPosition: (position: number | undefined) => void
}

function actionToBinding(action: KeyAction): BehaviorBinding {
    const p = action.params as ZmkBindingParams
    return {
        behaviorId: p.behaviorId,
        param1: p.param1,
        param2: p.param2,
    } as BehaviorBinding
}

export function BindingEditor({
    keymap,
    setKeymap,
    selectedKeyPosition,
    setSelectedKeyPosition,
}: BindingEditorProps): JSX.Element {
    const doIt = undoRedoStore((s) => s.doIt)
    const { service } = useConnectionStore()
    const { selectedLayerIndex } = useLayerSelectionStore()
    const behaviors = useBehaviors()

    const effectiveLayerIndex = useMemo((): number => {
        if (!keymap || keymap.layers.length === 0) return 0
        return Math.min(
            Math.max(0, selectedLayerIndex),
            keymap.layers.length - 1,
        )
    }, [keymap, selectedLayerIndex])

    const doUpdateBinding = useCallback(
        (binding: BehaviorBinding): void => {
            if (!service || !keymap || selectedKeyPosition === undefined) {
                console.error(
                    "Can't update binding without a selected key position and loaded keymap",
                )
                return
            }

            const layer = effectiveLayerIndex
            const layerId = keymap.layers[layer].id
            const keyPosition = selectedKeyPosition
            const oldAction = keymap.layers[layer].keys[keyPosition]
            const newAction = bindingToKeyAction(binding, behaviors, keymap)

            doIt?.(async (): Promise<() => Promise<void>> => {
                try {
                    await service.setKey(layerId, keyPosition, newAction)
                    setKeymap(
                        (prev: Keymap | undefined): Keymap | undefined => {
                            if (!prev) return prev
                            return produce(prev, (draft) => {
                                draft.layers[layer].keys[keyPosition] =
                                    newAction
                            })
                        },
                    )
                } catch (e) {
                    toast.error('Failed to set binding')
                    console.error('Failed binding details:', {
                        layerId,
                        keyPosition,
                        binding,
                        error: e,
                        oldAction,
                    })
                }

                return async (): Promise<void> => {
                    if (!service) return
                    try {
                        await service.setKey(layerId, keyPosition, oldAction)
                        setKeymap(
                            (prev: Keymap | undefined): Keymap | undefined => {
                                if (!prev) return prev
                                return produce(prev, (draft) => {
                                    draft.layers[layer].keys[keyPosition] =
                                        oldAction
                                })
                            },
                        )
                    } catch (e) {
                        console.error('Failed to undo set binding', e)
                    }
                }
            })
        },
        [
            service,
            keymap,
            doIt,
            effectiveLayerIndex,
            selectedKeyPosition,
            setKeymap,
            behaviors,
        ],
    )

    const selectedBinding = useMemo((): BehaviorBinding | null => {
        if (
            keymap == null ||
            selectedKeyPosition == null ||
            !keymap.layers[effectiveLayerIndex] ||
            selectedKeyPosition >=
                keymap.layers[effectiveLayerIndex].keys.length
        )
            return null

        return actionToBinding(
            keymap.layers[effectiveLayerIndex].keys[selectedKeyPosition],
        )
    }, [keymap, effectiveLayerIndex, selectedKeyPosition])

    const behaviorList = useMemo(() => Object.values(behaviors), [behaviors])
    const layerList = useMemo(
        () =>
            keymap?.layers.map(({ id, name }, li) => ({
                id,
                name: name || li.toLocaleString(),
            })) ?? [],
        [keymap],
    )

    return (
        <>
            {selectedKeyPosition !== undefined && (
                <div className="p-2 col-start-2 row-start-2 w-full">
                    <Card className="relative">
                        <CardContent className="p-4">
                            <div className="flex flex-row gap-4 w-full">
                                {selectedBinding && (
                                    <BehaviorBindingPicker
                                        binding={selectedBinding}
                                        behaviors={behaviorList}
                                        layers={layerList}
                                        onBindingChanged={doUpdateBinding}
                                    />
                                )}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-2 top-2 h-8 w-8 p-0"
                                onClick={(): void => {
                                    setSelectedKeyPosition(undefined)
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
        </>
    )
}
