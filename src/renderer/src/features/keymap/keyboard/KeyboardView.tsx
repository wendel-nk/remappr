/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Keymap } from '@firmware/types'
import { PhysicalLayoutCanvas, type KeyPosition } from './PhysicalLayoutCanvas'
import { HidUsageLabel } from './HidUsageLabel'
import type { HoldTapLabels } from './KeyButton'
import { useLocalStorageState } from '@/hooks/use-local-storage-state'
import { deserializeLayoutZoom, LayoutZoom } from '@/lib/helpers'
import { useLayout } from '@/hooks/use-layouts'
import { KeyboardZoomSlider } from '../editor/KeyboardZoomSlider'
import useConnectionStore from '@/stores/connectionStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import { useKeypressDetection } from '@/hooks/use-keypress-detection'
import type { KeypressDetectionConfig } from '@/lib/keypress/keypressDetector'
import { resolveBindingLabels, type ResolvedHoldTapDescriptor } from '@firmware'

interface EncoderSelection {
    slot: number
    dir: 'cw' | 'ccw'
}

interface KeyboardViewProps {
    keymap: Keymap | undefined
    selectedKeyPosition: number | undefined
    setSelectedKeyPosition: (position: number | undefined) => void
    selectedEncoder?: EncoderSelection | undefined
    setSelectedEncoder?: (sel: EncoderSelection | undefined) => void
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
    selectedEncoder,
    setSelectedEncoder,
}: KeyboardViewProps): JSX.Element {
    const { layouts, selectedPhysicalLayoutIndex } = useLayout()
    const { selectedLayerIndex, setSelectedLayerIndex } =
        useLayerSelectionStore()
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
                  }
                : null,
        [layouts, keymap, effectiveLayerIndex, selectedPhysicalLayoutIndex],
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

    const positions: KeyPosition[] = useMemo(() => {
        if (!layouts || !keymap) return []
        const layout = layouts[selectedPhysicalLayoutIndex]
        if (!layout) return []
        const keyPositions: KeyPosition[] = resolveBindingLabels(
            layout,
            keymap,
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

        const encoderActions = keymap.layers[effectiveLayerIndex]?.encoders
        const encoderSlots = layout.encoders ?? []
        if (!encoderActions || encoderSlots.length === 0) return keyPositions

        const encoderPositions: KeyPosition[] = []
        encoderSlots.forEach((slot, i) => {
            const action = encoderActions[i]
            if (!action) return
            // Two half-unit buttons side by side: ccw left, cw right.
            encoderPositions.push({
                id: `enc-${i}-ccw`,
                header: 'CCW',
                behaviorBinding: action.ccw.label.primary,
                x: slot.x,
                y: slot.y,
                width: 0.5,
                height: 1,
                encoder: { slot: i, dir: 'ccw' },
                children: <span>{action.ccw.label.primary}</span>,
            })
            encoderPositions.push({
                id: `enc-${i}-cw`,
                header: 'CW',
                behaviorBinding: action.cw.label.primary,
                x: slot.x + 0.5,
                y: slot.y,
                width: 0.5,
                height: 1,
                encoder: { slot: i, dir: 'cw' },
                children: <span>{action.cw.label.primary}</span>,
            })
        })
        return [...keyPositions, ...encoderPositions]
    }, [layouts, keymap, selectedPhysicalLayoutIndex, effectiveLayerIndex])

    return (
        <>
            {layouts && keymap && (
                <div className="p-2 col-start-2 row-start-1 items-center justify-center relative min-w-0 flex h-full bg-accent">
                    <PhysicalLayoutCanvas
                        positions={positions}
                        oneU={48}
                        hoverZoom={true}
                        zoom={keymapScale}
                        selectedPosition={selectedKeyPosition}
                        onPositionClicked={setSelectedKeyPosition}
                        selectedEncoder={selectedEncoder}
                        onEncoderClicked={(slot, dir): void =>
                            setSelectedEncoder?.({ slot, dir })
                        }
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
