// pattern-check: skip mechanical port — bridges neutral KeyAction store with KeyActionPicker via service.listActionTypes/buildKeyAction
import { X } from 'lucide-react'
import {
    KeyActionPicker,
    type KeyActionDraft,
} from '@/features/actions/KeyActionPicker'
import { useCallback, useEffect, useMemo, useState } from 'react'
import undoRedoStore from '@/stores/undoRedoStore'
import useConnectionStore from '@/stores/connectionStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import { produce } from 'immer'
import type { ActionType, KeyAction, Keymap } from '@firmware/types'
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

export function BindingEditor({
    keymap,
    setKeymap,
    selectedKeyPosition,
    setSelectedKeyPosition,
}: BindingEditorProps): JSX.Element {
    const doIt = undoRedoStore((s) => s.doIt)
    const { service } = useConnectionStore()
    const { selectedLayerIndex } = useLayerSelectionStore()
    const [actionTypes, setActionTypes] = useState<ActionType[]>([])

    useEffect(() => {
        if (!service) {
            /* eslint-disable react-hooks/set-state-in-effect */
            setActionTypes([])
            /* eslint-enable react-hooks/set-state-in-effect */
            return
        }
        let cancelled = false
        service.listActionTypes().then((types) => {
            if (!cancelled) setActionTypes(types)
        })
        return (): void => {
            cancelled = true
        }
    }, [service])

    const effectiveLayerIndex = useMemo((): number => {
        if (!keymap || keymap.layers.length === 0) return 0
        return Math.min(
            Math.max(0, selectedLayerIndex),
            keymap.layers.length - 1,
        )
    }, [keymap, selectedLayerIndex])

    const doUpdateAction = useCallback(
        (draft: KeyActionDraft): void => {
            if (!service || !keymap || selectedKeyPosition === undefined) {
                console.error(
                    "Can't update action without a selected key position and loaded keymap",
                )
                return
            }

            const layer = effectiveLayerIndex
            const layerId = keymap.layers[layer].id
            const keyPosition = selectedKeyPosition
            const oldAction = keymap.layers[layer].keys[keyPosition]
            const newAction = service.buildKeyAction(draft.kind, draft.params)

            doIt?.(async (): Promise<() => Promise<void>> => {
                try {
                    await service.setKey(layerId, keyPosition, newAction)
                    setKeymap(
                        (prev: Keymap | undefined): Keymap | undefined => {
                            if (!prev) return prev
                            return produce(prev, (draftKeymap) => {
                                draftKeymap.layers[layer].keys[keyPosition] =
                                    newAction
                            })
                        },
                    )
                } catch (e) {
                    toast.error('Failed to set action')
                    console.error('Failed action details:', {
                        layerId,
                        keyPosition,
                        draft,
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
                                return produce(prev, (draftKeymap) => {
                                    draftKeymap.layers[layer].keys[
                                        keyPosition
                                    ] = oldAction
                                })
                            },
                        )
                    } catch (e) {
                        console.error('Failed to undo set action', e)
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
        ],
    )

    const selectedAction = useMemo((): KeyAction | null => {
        if (
            keymap == null ||
            selectedKeyPosition == null ||
            !keymap.layers[effectiveLayerIndex] ||
            selectedKeyPosition >=
                keymap.layers[effectiveLayerIndex].keys.length
        )
            return null

        return keymap.layers[effectiveLayerIndex].keys[selectedKeyPosition]
    }, [keymap, effectiveLayerIndex, selectedKeyPosition])

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
                                {selectedAction && (
                                    <KeyActionPicker
                                        action={selectedAction}
                                        actionTypes={actionTypes}
                                        layers={layerList}
                                        onChange={doUpdateAction}
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
