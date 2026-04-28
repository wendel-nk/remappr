import { useCallback, useRef, useState } from 'react'
import type { Keymap } from '@zmkfirmware/zmk-studio-ts-client/keymap'
import undoRedoStore from '@/stores/undoRedoStore'
import useConnectionStore from '@/stores/connectionStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import { moveLayer } from '@firmware/zmk/rpc/rpcLayerService'

export interface DragHandlers {
    draggable: boolean
    onDragStart: (e: React.DragEvent) => void
    onDragOver: (e: React.DragEvent) => void
    onDragEnter: () => void
    onDragLeave: () => void
    onDrop: (e: React.DragEvent) => void
    onDragEnd: () => void
}

interface UseLayerDragReorderArgs {
    setKeymap?: (updater: (draft: Keymap) => void) => void
}

interface UseLayerDragReorderResult {
    dragSourceIndex: number | null
    dragOverIndex: number | null
    handlersFor: (index: number) => DragHandlers
}

export function useLayerDragReorder({
    setKeymap,
}: UseLayerDragReorderArgs): UseLayerDragReorderResult {
    const { doIt } = undoRedoStore()
    const { service } = useConnectionStore()
    const { setSelectedLayerIndex } = useLayerSelectionStore()

    const sourceRef = useRef<number | null>(null)
    const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null)
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

    const performMove = useCallback(
        (start: number, dest: number): void => {
            if (!service || !setKeymap) return
            if (start === dest) return
            doIt?.(async () => {
                await moveLayer(start, dest, setKeymap, setSelectedLayerIndex)
                return async () =>
                    moveLayer(dest, start, setKeymap, setSelectedLayerIndex)
            })
        },
        [service, doIt, setKeymap, setSelectedLayerIndex],
    )

    const handlersFor = useCallback(
        (index: number): DragHandlers => ({
            draggable: true,
            onDragStart: (e) => {
                sourceRef.current = index
                setDragSourceIndex(index)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', String(index))
            },
            onDragOver: (e) => {
                if (sourceRef.current === null) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
            },
            onDragEnter: () => {
                if (sourceRef.current === null) return
                setDragOverIndex(index)
            },
            onDragLeave: () => {
                setDragOverIndex((prev) => (prev === index ? null : prev))
            },
            onDrop: (e) => {
                e.preventDefault()
                const start = sourceRef.current
                sourceRef.current = null
                setDragSourceIndex(null)
                setDragOverIndex(null)
                if (start === null || start === index) return
                performMove(start, index)
            },
            onDragEnd: () => {
                sourceRef.current = null
                setDragSourceIndex(null)
                setDragOverIndex(null)
            },
        }),
        [performMove],
    )

    return { dragSourceIndex, dragOverIndex, handlersFor }
}
