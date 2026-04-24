/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Keymap } from '@zmkfirmware/zmk-studio-ts-client/keymap'
import { KeyboardLayout } from './KeyboardLayout.tsx'
import { useLocalStorageState } from '@/misc/useLocalStorageState.ts'
import { deserializeLayoutZoom, LayoutZoom } from '../../helpers/helpers.ts'
import { useLayout } from '../../helpers/useLayouts.ts'
import { Zoom } from '../Zoom.tsx'
import useConnectionStore from '@/stores/ConnectionStore.ts'
import useLayerSelectionStore from '@/stores/LayerSelectionStore.ts'
import { useBehaviors } from '../../helpers/Behaviors.ts'
import { getKeymapLayout } from '@/services/RpcEventsService.ts'
import {
    keyboardKeypressService,
    KeypressDetectionConfig,
} from '@/services/KeyboardKeypressService.ts'

interface KeyboardProps {
    keymap: Keymap | undefined
    selectedKeyPosition: number | undefined
    setSelectedKeyPosition: (position: number | undefined) => void
}

export default function Keyboard({
    keymap,
    selectedKeyPosition,
    setSelectedKeyPosition,
}: KeyboardProps): JSX.Element {
    const { layouts, selectedPhysicalLayoutIndex } = useLayout()
    const { selectedLayerIndex, setSelectedLayerIndex } =
        useLayerSelectionStore()
    const behaviors = useBehaviors()
    const { connection } = useConnectionStore()

    // Compute effective layer index - clamp to valid bounds when out of range
    const effectiveLayerIndex = useMemo(() => {
        if (!keymap || keymap.layers.length === 0) {
            return 0
        }
        // Clamp selectedLayerIndex to valid range
        return Math.min(
            Math.max(0, selectedLayerIndex),
            keymap.layers.length - 1,
        )
    }, [keymap, selectedLayerIndex])

    // Reset layer selection when connection changes
    useEffect(() => {
        setSelectedLayerIndex(0)
        setSelectedKeyPosition(undefined)
    }, [connection, setSelectedLayerIndex, setSelectedKeyPosition])

    //todo change to zustand storing system

    const [keymapScale, setKeymapScale] = useLocalStorageState<LayoutZoom>(
        'keymapScale',
        'auto',
        { deserialize: deserializeLayoutZoom },
    )

    // State for tracking pressed keys
    const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set())

    // Create keypress detection config - memoize to avoid recreating on every render
    const keypressConfig: KeypressDetectionConfig = useMemo(
        () => ({
            layouts: layouts || [],
            keymap: keymap!,
            selectedLayerIndex: effectiveLayerIndex,
            selectedPhysicalLayoutIndex,
            behaviors,
        }),
        [
            layouts,
            keymap,
            effectiveLayerIndex,
            selectedPhysicalLayoutIndex,
            behaviors,
        ],
    )

    // Keyboard event handlers using the service
    const handleKeyPressed = useCallback((keyPosition: number) => {
        setPressedKeys((prev) => new Set(prev).add(keyPosition))
    }, [])

    const handleKeyReleased = useCallback((keyPosition: number) => {
        setPressedKeys((prev) => {
            const newSet = new Set(prev)
            newSet.delete(keyPosition)
            return newSet
        })
    }, [])

    // Set up keyboard event listeners using the service
    useEffect(() => {
        if (!layouts || !keymap || !behaviors) return

        return keyboardKeypressService.setupKeyboardListeners(
            keypressConfig,
            handleKeyPressed,
            handleKeyReleased,
        )
    }, [
        layouts,
        keymap,
        behaviors,
        keypressConfig,
        handleKeyPressed,
        handleKeyReleased,
    ])

    // Clear pressed keys when layer changes
    useEffect(() => {
        setPressedKeys(new Set())
    }, [effectiveLayerIndex])

    useEffect(() => {
        if (!layouts) return
        ;(async () => {
            await getKeymapLayout(selectedPhysicalLayoutIndex, layouts)
        })()
    }, [selectedPhysicalLayoutIndex, connection, layouts])

    return (
        <>
            {layouts && keymap && behaviors && (
                <div className="p-2 col-start-2 row-start-1 items-center justify-center relative min-w-0 flex h-full bg-base-300">
                    <KeyboardLayout
                        keymap={keymap}
                        layout={layouts[selectedPhysicalLayoutIndex]}
                        behaviors={behaviors}
                        scale={keymapScale}
                        selectedLayerIndex={effectiveLayerIndex}
                        selectedKeyPosition={selectedKeyPosition}
                        onKeyPositionClicked={setSelectedKeyPosition}
                        pressedKeys={pressedKeys}
                    />
                    <Zoom
                        value={keymapScale}
                        onChange={(e) => {
                            setKeymapScale(deserializeLayoutZoom(e))
                        }}
                    />
                </div>
            )}
        </>
    )
}
