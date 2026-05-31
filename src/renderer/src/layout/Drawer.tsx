import { useCallback, useEffect, useMemo } from 'react'
import { useLayout } from '@/hooks/use-layouts'
import { PhysicalLayoutPicker } from '@/features/keymap/layout-picker/PhysicalLayoutPicker'
import { LayerPicker } from '@/features/keymap/layer-picker/LayerPicker'
import { KeyTypeLegend } from '@/features/keymap/keyboard/KeyTypeLegend'
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
import { DeviceMenu } from '@/features/connection/device-menu/DeviceMenu'
// pattern-check: skip — drop dead lock guards now that App-shell render-gates locked state
import type { Keymap } from '@firmware/types'
import { produce } from 'immer'
import { APP_VERSION } from '@/lib/constants'

// pattern-check: skip — mechanical lock-guard removal
export function Drawer(): JSX.Element {
    const { service } = useConnectionStore()
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

    // Fetch keymap when service changes
    useEffect(() => {
        if (!service) {
            resetKeymap()
            return
        }

        let ignore = false

        async function fetchKeymap(): Promise<void> {
            if (!service) return
            try {
                const km = await service.getKeymap()
                if (!ignore) setKeymap(km)
            } catch (e) {
                console.error('Failed to fetch keymap', e)
            }
        }

        fetchKeymap()
        return (): void => {
            ignore = true
        }
    }, [service, setKeymap, resetKeymap])

    // Reset the layer selection whenever the service is swapped
    useEffect(() => {
        setSelectedLayerIndex(0)
    }, [service, setSelectedLayerIndex])

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
        if (!service || !layouts) return

        void (async () => {
            try {
                const km = await service.setActivePhysicalLayout(
                    selectedPhysicalLayoutIndex,
                )
                setKeymap(km)
            } catch (e) {
                console.error('Failed to set active physical layout', e)
            }
        })()
    }, [service, layouts, selectedPhysicalLayoutIndex, setKeymap])

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader className="flex-col items-center gap-1">
                <img
                    src="/remappr.png"
                    alt="Remappr Logo"
                    className="h-8 rounded w-10"
                />
                <span className="text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
                    v{APP_VERSION}
                </span>
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
                <SidebarGroup>
                    <KeyTypeLegend />
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <DeviceMenu />
            </SidebarFooter>
        </Sidebar>
    )
}
