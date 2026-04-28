/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Keymap } from '@zmkfirmware/zmk-studio-ts-client/keymap'
import { PhysicalLayoutCanvas, type KeyPosition } from './PhysicalLayoutCanvas'
import { HidUsageLabel } from './HidUsageLabel'
import type { HoldTapLabels } from './KeyButton'
import { useLocalStorageState } from '@/hooks/use-local-storage-state'
import { deserializeLayoutZoom, LayoutZoom } from '@/lib/helpers'
import { useLayout } from '@/hooks/use-layouts'
import { KeyboardZoomSlider } from '../editor/KeyboardZoomSlider'
import useConnectionStore from '@/stores/connectionStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import { useBehaviors } from '@/hooks/use-behaviors'
import { getKeymapLayout } from '@firmware/zmk/rpc/rpcEventsService'
import { useKeypressDetection } from '@/hooks/use-keypress-detection'
import type { KeypressDetectionConfig } from '@/lib/keypress/keypressDetector'
import {
    resolveBindingLabels,
    type ResolvedHoldTapDescriptor,
} from '@/lib/keymap/resolveBindingLabels'

interface KeyboardViewProps {
    keymap: Keymap | undefined
    selectedKeyPosition: number | undefined
    setSelectedKeyPosition: (position: number | undefined) => void
}

function holdTapToLabels(desc: ResolvedHoldTapDescriptor): HoldTapLabels {
    const tap = (
        <HidUsageLabel hid_usage={desc.tapParam} header={desc.behaviorName} />
    )
    const hold =
        desc.holdNodeKind === 'layer' ? (
            <span>{desc.holdLayerMomentary}</span>
        ) : (
            <HidUsageLabel hid_usage={desc.holdParam} />
        )
    return { tap, hold, tooltip: desc.tooltip }
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
    const { service } = useConnectionStore()

    const effectiveLayerIndex = useMemo(() => {
        if (!keymap || keymap.layers.length === 0) return 0
        return Math.min(
            Math.max(0, selectedLayerIndex),
            keymap.layers.length - 1,
        )
    }, [keymap, selectedLayerIndex])

    useEffect(() => {
        setSelectedLayerIndex(0)
        setSelectedKeyPosition(undefined)
    }, [service, setSelectedLayerIndex, setSelectedKeyPosition])

    const [keymapScale, setKeymapScale] = useLocalStorageState<LayoutZoom>(
        'keymapScale',
        'auto',
        { deserialize: deserializeLayoutZoom },
    )

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

    useEffect(() => {
        setPressedKeys(new Set())
    }, [effectiveLayerIndex])

    useEffect(() => {
        if (!layouts) return
        ;(async () => {
            await getKeymapLayout(selectedPhysicalLayoutIndex, layouts)
        })()
    }, [selectedPhysicalLayoutIndex, service, layouts])

    const positions: KeyPosition[] = useMemo(() => {
        if (!layouts || !keymap || !behaviors) return []
        const layout = layouts[selectedPhysicalLayoutIndex]
        if (!layout) return []
        return resolveBindingLabels(
            layout,
            keymap,
            behaviors,
            effectiveLayerIndex,
        ).map((p) => ({
            id: p.id,
            header: p.header,
            behaviorBinding: p.behaviorBinding,
            holdTap: p.holdTap ? holdTapToLabels(p.holdTap) : undefined,
            x: p.x,
            y: p.y,
            width: p.width,
            height: p.height,
            r: p.r,
            rx: p.rx,
            ry: p.ry,
            children: p.outOfRange ? (
                <span></span>
            ) : (
                <HidUsageLabel
                    hid_usage={p.bindingParam1!}
                    header={p.behaviorName || 'Unknown'}
                />
            ),
        }))
    }, [
        layouts,
        keymap,
        behaviors,
        selectedPhysicalLayoutIndex,
        effectiveLayerIndex,
    ])

    return (
        <>
            {layouts && keymap && behaviors && (
                <div className="p-2 col-start-2 row-start-1 items-center justify-center relative min-w-0 flex h-full bg-accent">
                    <PhysicalLayoutCanvas
                        positions={positions}
                        oneU={48}
                        hoverZoom={true}
                        zoom={keymapScale}
                        selectedPosition={selectedKeyPosition}
                        onPositionClicked={setSelectedKeyPosition}
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
