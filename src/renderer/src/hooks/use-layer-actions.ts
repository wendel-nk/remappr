import { useCallback } from 'react'
import { toast } from 'sonner'
import type { Keymap } from '@zmkfirmware/zmk-studio-ts-client/keymap'
import undoRedoStore from '@/stores/undoRedoStore'
import useConnectionStore from '@/stores/connectionStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import {
    addLayer,
    changeName,
    removeLayer,
    restore,
} from '@firmware/zmk/rpc/rpcLayerService'

interface UseLayerActionsArgs {
    keymap?: Keymap
    setKeymap?: (updater: (draft: Keymap) => void) => void
}

interface UseLayerActionsResult {
    add: () => void
    remove: (layerIndex: number) => void
    changeLayerName: (id: number, oldName: string, newName: string) => void
    handleSaveNewLabel: (
        id: number,
        oldName: string,
        newName: string | null,
    ) => void
    selectionChanged: (layerIndex: number | string) => void
}

export function useLayerActions({
    keymap,
    setKeymap,
}: UseLayerActionsArgs): UseLayerActionsResult {
    const { doIt } = undoRedoStore()
    const { connection } = useConnectionStore()
    const { selectedLayerIndex, setSelectedLayerIndex } =
        useLayerSelectionStore()

    const add = useCallback((): void => {
        if (!connection || !setKeymap) return
        doIt?.(async () => {
            const index = await addLayer(
                keymap,
                setKeymap,
                setSelectedLayerIndex,
            )
            if (index < 0) return async () => {}
            return async () => removeLayer(index, setKeymap)
        })
    }, [connection, doIt, keymap, setKeymap, setSelectedLayerIndex])

    const remove = useCallback(
        (layerIndex: number): void => {
            if (!connection || !setKeymap) return
            if (!keymap) {
                toast.error('No keymap loaded')
                return
            }
            const index = layerIndex
            const layerId = keymap.layers[index].id
            const currentLayersCount = keymap.layers.length

            doIt?.(async () => {
                await removeLayer(index, setKeymap)
                if (selectedLayerIndex >= currentLayersCount - 1) {
                    setSelectedLayerIndex(Math.max(0, currentLayersCount - 2))
                } else if (selectedLayerIndex > index) {
                    setSelectedLayerIndex(selectedLayerIndex - 1)
                }
                return () =>
                    restore(layerId, index, setKeymap, setSelectedLayerIndex)
            })
        },
        [
            connection,
            doIt,
            keymap,
            selectedLayerIndex,
            setKeymap,
            setSelectedLayerIndex,
        ],
    )

    const changeLayerName = useCallback(
        (id: number, oldName: string, newName: string): void => {
            if (!connection || !setKeymap) return
            doIt?.(async () => {
                await changeName(id, newName, setKeymap)
                return async () => {
                    await changeName(id, oldName, setKeymap)
                }
            })
        },
        [connection, doIt, setKeymap],
    )

    const handleSaveNewLabel = useCallback(
        (id: number, oldName: string, newName: string | null): void => {
            if (newName !== null) changeLayerName(id, oldName, newName)
        },
        [changeLayerName],
    )

    const selectionChanged = useCallback(
        (layerIndex: number | string): void => {
            if (layerIndex === 'all') return
            if (typeof layerIndex !== 'number') return
            const maxIndex = (keymap?.layers.length ?? 0) - 1
            if (maxIndex < 0) return
            const clampedIndex = Math.min(Math.max(0, layerIndex), maxIndex)
            setSelectedLayerIndex(clampedIndex)
        },
        [keymap?.layers.length, setSelectedLayerIndex],
    )

    return {
        add,
        remove,
        changeLayerName,
        handleSaveNewLabel,
        selectionChanged,
    }
}
