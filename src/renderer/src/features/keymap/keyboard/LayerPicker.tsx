import { EllipsisVertical, Plus, Trash } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import undoRedoStore from '@/stores/undoRedoStore'
import useConnectionStore from '@/stores/connectionStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import LayerNameDialog from '../editor/LayerNameDialog'
import type { Keymap } from '@zmkfirmware/zmk-studio-ts-client/keymap'

import {
    SidebarGroupAction,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/ui/sidebar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import {
    addLayer,
    changeName,
    removeLayer,
    restore,
} from '@/services/rpcLayerService'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'

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

    onLayerClicked?: LayerClickCallback // todo remove if not needed
    setKeymap?: (updater: (draft: Keymap) => void) => void
    keymap?: Keymap
    setSelectedKey?: (key: number | undefined) => void
}

interface EditLabelData {
    id: number
    name: string
}

export const LayerPicker = ({
    layers,
    canAdd,
    canRemove,
    onLayerClicked,
    setKeymap,
    keymap,
}: LayerPickerProps): JSX.Element => {
    const [editLabelData, setEditLabelData] = useState<EditLabelData | null>(
        null,
    )
    const [dropdownOpen, setDropdownOpen] = useState<number | null>(null)
    const { doIt } = undoRedoStore()
    const { connection } = useConnectionStore()
    const { selectedLayerIndex, setSelectedLayerIndex } =
        useLayerSelectionStore()

    const layersArray = useMemo((): Array<{
        id: number
        name: string
        index: number
        selected: boolean
    }> => {
        return layers.map(
            (
                l: Layer,
                i: number,
            ): {
                id: number
                name: string
                index: number
                selected: boolean
            } => ({
                name: l.name || i.toLocaleString(),
                id: l.id,
                index: i,
                selected: i === selectedLayerIndex,
            }),
        )
    }, [layers, selectedLayerIndex])

    // Keep the selected layer valid only when the layer list shrinks (e.g. layer removal)
    const previousLengthRef = useRef<number>(layers?.length ?? 0)
    useEffect(() => {
        const currentLength = layers?.length ?? 0
        const previousLength = previousLengthRef.current

        // Detect the moment just after clicking "add layer" where the layer count
        // hasn't increased yet (selected index equals previous length).
        const awaitingNewLayer =
            selectedLayerIndex === previousLength &&
            currentLength === previousLength

        // Clamp when selection is out of range and we're not waiting for a newly added layer
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

    // console.log(layer_items)

    const selectionChanged = useCallback(
        (layerIndex: number | string) => {
            if (layerIndex === 'all') return
            if (typeof layerIndex !== 'number') return

            const maxIndex = layers.length - 1
            const clampedIndex = Math.min(Math.max(0, layerIndex), maxIndex)
            setSelectedLayerIndex(clampedIndex)
        },
        [layers.length, setSelectedLayerIndex],
    )

    // const { dragAndDropHooks } = useDragAndDrop( {
    // 	renderDropIndicator ( target ) {
    // 		return (
    // 			<DropIndicator
    // 				target={ target }
    // 				className={
    // 					"data-[drop-target]:outline outline-1 outline-accent"
    // 				}
    // 			/>
    // 		)
    // 	},
    // 	getItems: ( keys ) =>
    // 		[ ...keys ].map( ( key ) => ({ "text/plain": key.toLocaleString() }) ),
    // 	onReorder ( e ) {
    // 		const startIndex = layer_items.findIndex( ( l ) => e.keys.has( l.id ) )
    // 		const endIndex = layer_items.findIndex( ( l ) => l.id === e.target.key )
    // 		moveLayer?.( startIndex, endIndex )
    // 	}
    // } )

    // const moveLayer = useCallback( ( start: number, end: number ) => {
    // 		const doMove = async ( startIndex: number, destIndex: number ) => {
    // 			if ( !connection ) {
    // 				return
    // 			}
    //
    // 			const resp = await callRpc( connection, {
    // 				keymap: { moveLayer: { startIndex, destIndex } }
    // 			} )
    //
    // 			if ( resp.keymap?.moveLayer?.ok ) {
    // 				setKeymap( resp.keymap?.moveLayer?.ok )
    // 				setSelectedLayerIndex( destIndex )
    // 			} else {
    // 				console.error( "Error moving", resp )
    // 			}
    // 		}
    //
    // 		doIt?.( async () => {
    // 			await doMove( start, end )
    // 			return () => doMove( end, start )
    // 		} )
    // 	}, [ connection, doIt, setKeymap, setSelectedLayerIndex ]
    // )

    const add = useCallback(() => {
        if (!connection || !setKeymap) return

        doIt?.(async () => {
            const index = await addLayer(
                keymap,
                setKeymap,
                setSelectedLayerIndex,
            )
            if (index < 0) {
                return async () => {}
            }
            return async () => removeLayer(index, setKeymap)
        })
    }, [connection, doIt, keymap, setKeymap, setSelectedLayerIndex])

    const remove = useCallback(
        (layerIndex: number) => {
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
                // Adjust selected layer index if the removed layer was selected or before selected
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
        (id: number, oldName: string, newName: string) => {
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
        (id: number, oldName: string, newName: string | null) => {
            if (newName !== null) {
                changeLayerName?.(id, oldName, newName)
            }
        },
        [changeLayerName],
    )

    // Close dropdown when clicking outside
    useEffect((): (() => void) => {
        const handleClickOutside = (): void => {
            if (dropdownOpen !== null) {
                setDropdownOpen(null)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return (): void => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [dropdownOpen])

    // Close dropdown when edit modal opens - using a ref to avoid setState in effect
    const closeDropdownOnEdit = editLabelData !== null && dropdownOpen !== null
    if (closeDropdownOnEdit) {
        setDropdownOpen(null)
    }

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
                    <SidebarMenuItem key={item.id ?? item.index}>
                        <SidebarMenuButton
                            asChild
                            isActive={item.index === selectedLayerIndex}
                            onClick={() => {
                                selectionChanged(item.index)
                                onLayerClicked?.(item.index)
                            }}
                        >
                            <span>{item.name}</span>
                        </SidebarMenuButton>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuAction
                                    showOnHover
                                    className="data-[state=open]:bg-accent rounded-sm"
                                >
                                    <EllipsisVertical />{' '}
                                    <span className="sr-only">More</span>
                                </SidebarMenuAction>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" align="start">
                                <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                >
                                    <LayerNameDialog
                                        onClose={() => setEditLabelData(null)}
                                        editLabelData={item}
                                        handleSaveNewLabel={handleSaveNewLabel}
                                    />
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    variant="destructive"
                                    disabled={!canRemove}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        remove(item.index)
                                    }}
                                >
                                    <Trash />
                                    <span>Delete</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </>
    )
}
