import { useCallback, useEffect, useMemo } from 'react'
import { useLayout } from '@/hooks/use-layouts'
import { PhysicalLayoutPicker } from '@/features/keymap/keyboard/PhysicalLayoutPicker'
import { LayerPicker } from '@/features/keymap/keyboard/LayerPicker'
import undoRedoStore from '@/stores/undoRedoStore'
import useConnectionStore from '@/stores/connectionStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import useKeymapStore from '@/stores/keymapStore'
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarHeader,
    SidebarFooter,
} from '@/ui/sidebar'
import { DeviceMenu } from '@/features/connection/DeviceMenu'
import { setKeymapRequest } from '@/services/rpcEventsService'
import { callRpc } from '@/services/rpcCall'
import { LockState } from '@zmkfirmware/zmk-studio-ts-client/core'
import { Keymap } from '@zmkfirmware/zmk-studio-ts-client/keymap'
import { produce } from 'immer'

export function Drawer(): JSX.Element {
    const { connection, lockState } = useConnectionStore()
    const { setSelectedLayerIndex } = useLayerSelectionStore()
    const { keymap, setKeymap, resetKeymap } = useKeymapStore()
    const {
        layouts,
        selectedPhysicalLayoutIndex,
        setSelectedPhysicalLayoutIndex,
    } = useLayout()
    const { doIt } = undoRedoStore()

    // Adapter for LayerPicker - converts immer-style updater to store-compatible function
    const layerPickerSetKeymap = useMemo(
        () => (updater: (draft: Keymap) => void) => {
            setKeymap((prev: Keymap | undefined): Keymap | undefined => {
                if (!prev) return prev
                return produce(prev, updater)
            })
        },
        [setKeymap],
    )

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
        async function fetchKeymap(): Promise<void> {
            const response = await callRpc({
                keymap: { getKeymap: true },
            })
            const keymapData = response?.keymap?.getKeymap
            console.log('Got the keymap!')
            if (!ignore && keymapData) {
                setKeymap(keymapData)
            }
        }

        fetchKeymap()
        return (): void => {
            ignore = true
        }
    }, [connection, lockState, setKeymap, resetKeymap])

    // Reset the layer selection whenever the connection is swapped or locked state changes
    useEffect(() => {
        setSelectedLayerIndex(0)
    }, [connection, lockState, setSelectedLayerIndex])

    const doSelectPhysicalLayout = useCallback(
        (i: number): void => {
            const oldLayout = selectedPhysicalLayoutIndex
            doIt?.(async (): Promise<() => Promise<void>> => {
                setSelectedPhysicalLayoutIndex(i)

                return async (): Promise<void> => {
                    setSelectedPhysicalLayoutIndex(oldLayout)
                }
            })
        },
        [doIt, selectedPhysicalLayoutIndex, setSelectedPhysicalLayoutIndex],
    )

    useEffect(() => {
        if (!connection || !layouts) return

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
                    {layouts && (
                        <PhysicalLayoutPicker
                            layouts={layouts}
                            selectedPhysicalLayoutIndex={
                                selectedPhysicalLayoutIndex
                            }
                            onPhysicalLayoutClicked={doSelectPhysicalLayout}
                        />
                    )}
                </SidebarGroup>
                <SidebarGroup>
                    {keymap && (
                        <LayerPicker
                            layers={keymap.layers}
                            keymap={keymap}
                            setKeymap={layerPickerSetKeymap}
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
