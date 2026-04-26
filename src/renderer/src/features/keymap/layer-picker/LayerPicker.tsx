import { Plus } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import type { Keymap } from '@zmkfirmware/zmk-studio-ts-client/keymap'

import useLayerSelectionStore from '@/stores/layerSelectionStore'
import {
    SidebarGroupAction,
    SidebarGroupLabel,
    SidebarMenu,
} from '@/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { useLayerActions } from '@/hooks/use-layer-actions'

import { LayerListItem } from './LayerListItem'

interface Layer {
    id: number
    name?: string
}

export type LayerClickCallback = (index: number) => void
export type LayerMovedCallback = (index: number, destination: number) => void

interface LayerPickerProps {
    layers: Array<Layer>
    canAdd?: boolean
    canRemove?: boolean
    onLayerClicked?: LayerClickCallback
    setKeymap?: (updater: (draft: Keymap) => void) => void
    keymap?: Keymap
    setSelectedKey?: (key: number | undefined) => void
}

export const LayerPicker = ({
    layers,
    canAdd,
    canRemove,
    onLayerClicked,
    setKeymap,
    keymap,
}: LayerPickerProps): JSX.Element => {
    const { selectedLayerIndex, setSelectedLayerIndex } =
        useLayerSelectionStore()
    const { add, remove, handleSaveNewLabel, selectionChanged } =
        useLayerActions({ keymap, setKeymap })

    const layersArray = useMemo(
        () =>
            layers.map((l, i) => ({
                name: l.name || i.toLocaleString(),
                id: l.id,
                index: i,
                selected: i === selectedLayerIndex,
            })),
        [layers, selectedLayerIndex],
    )

    const previousLengthRef = useRef<number>(layers?.length ?? 0)
    useEffect(() => {
        const currentLength = layers?.length ?? 0
        const previousLength = previousLengthRef.current

        const awaitingNewLayer =
            selectedLayerIndex === previousLength &&
            currentLength === previousLength

        if (
            currentLength > 0 &&
            selectedLayerIndex >= currentLength &&
            !awaitingNewLayer
        ) {
            setSelectedLayerIndex(currentLength - 1)
        }
        if (selectedLayerIndex < 0) {
            setSelectedLayerIndex(0)
        }
        previousLengthRef.current = currentLength
    }, [layers?.length, selectedLayerIndex, setSelectedLayerIndex])

    return (
        <>
            <SidebarGroupLabel>Layers</SidebarGroupLabel>
            <SidebarGroupAction
                title="Add Layer"
                onClick={add}
                disabled={!canAdd}
            >
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span>
                            <Plus className="size-4" />
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Add Layer</p>
                    </TooltipContent>
                </Tooltip>
            </SidebarGroupAction>
            <SidebarMenu>
                {layersArray.map((item) => (
                    <LayerListItem
                        key={item.id ?? item.index}
                        item={item}
                        selectedLayerIndex={selectedLayerIndex}
                        canRemove={canRemove}
                        onSelect={(idx) => {
                            selectionChanged(idx)
                            onLayerClicked?.(idx)
                        }}
                        onRemove={remove}
                        onSaveNewLabel={handleSaveNewLabel}
                    />
                ))}
            </SidebarMenu>
        </>
    )
}
