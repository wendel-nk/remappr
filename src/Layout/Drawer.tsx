import React, { useCallback, useEffect } from 'react'
import { useLayout } from '../helpers/useLayouts.ts'
import { PhysicalLayoutPicker } from '../components/keyboard/PhysicalLayoutPicker.tsx'
import { LayerPicker } from '../components/keyboard/LayerPicker.tsx'
import undoRedoStore from '../stores/UndoRedoStore.ts'
import useConnectionStore from '../stores/ConnectionStore.ts'
import useLayerSelectionStore from '../stores/LayerSelectionStore.ts'
import useKeymapStore from '../stores/KeymapStore.ts'
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarHeader,
    SidebarFooter,
} from "@/components/ui/sidebar.tsx"
import { DeviceMenu } from '../components/DeviceMenu.tsx'
import { setKeymapRequest } from "@/services/RpcEventsService.ts"
import { callRemoteProcedureControl } from "@/services/CallRemoteProcedureControl.ts"
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core"

interface DrawerProps {
    children?: React.ReactNode
}

export function Drawer({}: DrawerProps) {
    const { connection, lockState } = useConnectionStore()
    const { setSelectedLayerIndex } = useLayerSelectionStore()
    const { keymap, setKeymap, resetKeymap } = useKeymapStore()
    const {
        layouts,
        selectedPhysicalLayoutIndex,
        setSelectedPhysicalLayoutIndex,
    } = useLayout()
    const { doIt } = undoRedoStore()

    // Fetch keymap when connection changes or becomes unlocked
    useEffect(() => {
        if (!connection || lockState !== LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED) {
            resetKeymap()
            return
        }

        let ignore = false
        async function fetchKeymap() {
            const response = await callRemoteProcedureControl({ keymap: { getKeymap: true } })
            const keymapData = response?.keymap?.getKeymap
            console.log('Got the keymap!')
            if (!ignore && keymapData) {
                setKeymap(keymapData)
            }
        }

        fetchKeymap()
        return () => { ignore = true }
    }, [connection, lockState, setKeymap, resetKeymap])

	useEffect(() => {
		setSelectedLayerIndex(0)
	}, [connection, setSelectedLayerIndex])

    const doSelectPhysicalLayout = useCallback(
        (i: number) => {
            const oldLayout = selectedPhysicalLayoutIndex
            doIt?.(async () => {
                setSelectedPhysicalLayoutIndex(i)

                return async () => {
                    setSelectedPhysicalLayoutIndex(oldLayout)
                }
            })
        },
        [doIt, selectedPhysicalLayoutIndex, setSelectedPhysicalLayoutIndex],
    )



    useEffect(() => {
	    if (!connection) return

	    (async ()=> {
		    console.log(123123)
		    const result = await setKeymapRequest(layouts, selectedPhysicalLayoutIndex)
		    if (result) {
			    setKeymap(result)
		    }
	    })()

    }, [connection, layouts, selectedPhysicalLayoutIndex, setKeymap])


    return (
            <Sidebar collapsible="icon" variant='inset' >
                <SidebarHeader><img src="/zmk.svg" alt="ZMK Logo" className="h-8 rounded" />
                    {/*<span className="px-3">Studio</span>*/}
                </SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                        <PhysicalLayoutPicker
                            layouts={layouts}
                            selectedPhysicalLayoutIndex={selectedPhysicalLayoutIndex}
                            onPhysicalLayoutClicked={doSelectPhysicalLayout}
                        />
                    </SidebarGroup>
                    <SidebarGroup>
                        {keymap && (
                            <LayerPicker
                                layers={keymap.layers}
                                keymap={keymap}
                                setKeymap={setKeymap}
                                canAdd={(keymap.availableLayers || 0) > 0}
                                canRemove={(keymap.layers?.length || 0) > 1}
                            />
                        )}
                    </SidebarGroup>
                </SidebarContent>
                <SidebarFooter>
                    <DeviceMenu />
                </SidebarFooter>
            </Sidebar>
    )
}
