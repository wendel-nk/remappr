import { useCallback, useEffect } from 'react'
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
} from '@/components/ui/sidebar.tsx'
import { DeviceMenu } from '../components/DeviceMenu.tsx'
import { setKeymapRequest } from '@/services/RpcEventsService.ts'
import { callRemoteProcedureControl } from '@/services/CallRemoteProcedureControl.ts'
import { LockState } from '@zmkfirmware/zmk-studio-ts-client/core'

export function Drawer() {
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
        if (
            !connection ||
            lockState !== LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED
        ) {
            resetKeymap()
            return
        }

        let ignore = false
        async function fetchKeymap() {
            const response = await callRemoteProcedureControl({
                keymap: { getKeymap: true },
            })
            const keymapData = response?.keymap?.getKeymap
            console.log('Got the keymap!')
            if (!ignore && keymapData) {
                setKeymap(keymapData)
            }
        }

        fetchKeymap()
        return () => {
            ignore = true
        }
    }, [connection, lockState, setKeymap, resetKeymap])

    // Reset the layer selection whenever the connection is swapped or locked state changes
    useEffect(() => {
        setSelectedLayerIndex(0)
    }, [connection, lockState, setSelectedLayerIndex])

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

        void (async () => {
            const result = await setKeymapRequest(
                layouts,
                selectedPhysicalLayoutIndex,
            )
            if (result) {
                setKeymap(result)
            }
        })()
    }, [connection, layouts, selectedPhysicalLayoutIndex, setKeymap])

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader className="flex-row justify-center">
                <img
                    src="/remappr.png"
                    alt="Remappr Logo"
                    className="h-8 rounded w-10"
                />
                {/*<span className="px-3">Studio</span>*/}
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <PhysicalLayoutPicker
                        layouts={layouts}
                        selectedPhysicalLayoutIndex={
                            selectedPhysicalLayoutIndex
                        }
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
