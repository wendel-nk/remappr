/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Keymap } from '@zmkfirmware/zmk-studio-ts-client/keymap'
import { KeyboardLayout } from './KeyboardLayout.tsx'
import { useLocalStorageState } from '@/hooks/use-local-storage-state.ts'
import { deserializeLayoutZoom, LayoutZoom } from '@/lib/helpers'
import { useLayout } from '@/hooks/use-layouts'
import { KeyboardZoomSlider } from '../editor/KeyboardZoomSlider'
import useConnectionStore from '@/stores/connectionStore.ts'
import useLayerSelectionStore from '@/stores/layerSelectionStore.ts'
import { useBehaviors } from '@/hooks/use-behaviors'
import { getKeymapLayout } from '@/services/rpcEventsService.ts'
import { useKeypressDetection } from '@/hooks/use-keypress-detection'
import type { KeypressDetectionConfig } from '@/lib/keypress/keypressDetector'

interface KeyboardViewProps {
    keymap: Keymap | undefined
    selectedKeyPosition: number | undefined
    setSelectedKeyPosition: (position: number | undefined) => void
}

export default function KeyboardView({
    keymap,
    selectedKeyPosition,
    setSelectedKeyPosition,
}: KeyboardViewProps): JSX.Element {
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

    const keypressConfig: KeypressDetectionConfig | null = useMemo(
        () =>
            layouts && keymap
                ? {
                      layouts,
                      keymap,
                      selectedLayerIndex: effectiveLayerIndex,
                      selectedPhysicalLayoutIndex,
                      behaviors,
                  }
                : null,
        [
            layouts,
            keymap,
            effectiveLayerIndex,
            selectedPhysicalLayoutIndex,
            behaviors,
        ],
    )

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

    useKeypressDetection(keypressConfig, {
        onPressed: handleKeyPressed,
        onReleased: handleKeyReleased,
    })

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
                <div className="p-2 col-start-2 row-start-1 items-center justify-center relative min-w-0 flex h-full bg-accent">
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
                    <KeyboardZoomSlider
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
