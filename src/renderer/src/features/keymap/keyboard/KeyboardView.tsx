/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { produce } from 'immer'
import { toast } from 'sonner'
import { Activity, Flame, RotateCcw } from 'lucide-react'
import type { Keymap } from '@firmware/types'
import { PhysicalLayoutCanvas, type KeyPosition } from './PhysicalLayoutCanvas'
import { HidUsageLabel } from './HidUsageLabel'
import type { HoldTapLabels } from './KeyButton'
import { KeyContextMenu } from './KeyContextMenu'
import { useLocalStorageState } from '@/hooks/use-local-storage-state'
import { useLayout } from '@/hooks/use-layouts'
import useConnectionStore from '@/stores/connectionStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import useKeymapStore from '@/stores/keymapStore'
import useClipboardStore from '@/stores/clipboardStore'
import useHeatmapStore from '@/stores/heatmapStore'
import undoRedoStore from '@/stores/undoRedoStore'
import { useKeypressDetection } from '@/hooks/use-keypress-detection'
import type { KeypressDetectionConfig } from '@/lib/keypress/keypressDetector'
import { resolveBindingLabels, type ResolvedHoldTapDescriptor } from '@firmware'
import { categoryForBinding } from '@/lib/keymap/keyCategory'

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
        <HidUsageLabel hid_usage={desc.tapParam} header={desc.actionTypeName} />
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

    const heatmapEnabled = useHeatmapStore((s) => s.enabled)
    const heatmapCounts = useHeatmapStore((s) => s.counts)
    const toggleHeatmap = useHeatmapStore((s) => s.toggle)
    const incrementHeat = useHeatmapStore((s) => s.increment)
    const resetHeat = useHeatmapStore((s) => s.reset)

    const [liveView, setLiveView] = useLocalStorageState<boolean>(
        'liveView',
        true,
    )

    const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set())
    // Mirror of pressedKeys for the heat-count repeat guard (keydown auto-repeats).
    const pressedRef = useRef<Set<number>>(new Set())
    const EMPTY_KEYS = useMemo(() => new Set<number>(), [])

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

    const handleKeyPressed = useCallback(
        (keyPosition: number) => {
            // Only count the leading edge of a press (keydown repeats while held).
            if (!pressedRef.current.has(keyPosition)) {
                pressedRef.current.add(keyPosition)
                incrementHeat(`${selectedPhysicalLayoutIndex}:${keyPosition}`)
            }
            setPressedKeys((prev) => new Set(prev).add(keyPosition))
        },
        [incrementHeat, selectedPhysicalLayoutIndex],
    )

    const handleKeyReleased = useCallback((keyPosition: number) => {
        pressedRef.current.delete(keyPosition)
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
        pressedRef.current = new Set()
        setPressedKeys(new Set())
    }, [effectiveLayerIndex, selectedPhysicalLayoutIndex])

    const setKeymapInStore = useKeymapStore((s) => s.setKeymap)
    const clipboardAction = useClipboardStore((s) => s.action)
    const setClipboardAction = useClipboardStore((s) => s.setAction)
    const doIt = undoRedoStore((s) => s.doIt)
    const [contextMenu, setContextMenu] = useState<{
        position: number
        x: number
        y: number
    } | null>(null)

    const handlePositionContextMenu = useCallback(
        (position: number, coords: { x: number; y: number }): void => {
            setContextMenu({ position, x: coords.x, y: coords.y })
        },
        [],
    )

    const dispatchSetKey = useCallback(
        (
            position: number,
            action: import('@firmware/types').KeyAction,
        ): void => {
            if (!service || !keymap) return
            const layer = effectiveLayerIndex
            const layerEntry = keymap.layers[layer]
            if (!layerEntry) return
            const layerId = layerEntry.id
            const oldAction = layerEntry.keys[position]
            doIt?.(async (): Promise<() => Promise<void>> => {
                try {
                    await service.setKey(layerId, position, action)
                    setKeymapInStore((prev) => {
                        if (!prev) return prev
                        return produce(prev, (d) => {
                            d.layers[layer].keys[position] = action
                        })
                    })
                } catch (e) {
                    toast.error('Failed to set action')
                    console.error('contextmenu setKey failed', e)
                }
                return async (): Promise<void> => {
                    try {
                        await service.setKey(layerId, position, oldAction)
                        setKeymapInStore((prev) => {
                            if (!prev) return prev
                            return produce(prev, (d) => {
                                d.layers[layer].keys[position] = oldAction
                            })
                        })
                    } catch (e) {
                        console.error('Failed to undo contextmenu setKey', e)
                    }
                }
            })
        },
        [service, keymap, effectiveLayerIndex, doIt, setKeymapInStore],
    )

    const handleCopy = useCallback(
        (position: number): void => {
            const action = keymap?.layers[effectiveLayerIndex]?.keys[position]
            if (action) {
                setClipboardAction(action)
                toast.success('Binding copied')
            }
        },
        [keymap, effectiveLayerIndex, setClipboardAction],
    )

    const handlePaste = useCallback(
        (position: number): void => {
            if (!clipboardAction) return
            dispatchSetKey(position, clipboardAction)
        },
        [clipboardAction, dispatchSetKey],
    )

    const basePositions: KeyPosition[] = useMemo(() => {
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
            actionLabel: p.actionLabel,
            holdTap: p.holdTap ? holdTapToLabels(p.holdTap) : undefined,
            category: categoryForBinding({
                actionLabel: p.actionLabel,
                bindingParam1: p.bindingParam1,
                actionTypeName: p.actionTypeName,
                outOfRange: p.outOfRange,
                isHoldTap: !!p.holdTap,
                holdIsLayer: p.holdTap?.holdNodeKind === 'layer',
            }),
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
                    header={p.actionTypeName || 'Unknown'}
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
                actionLabel: action.ccw.label.primary,
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
                actionLabel: action.cw.label.primary,
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

    // Inject heatmap tint + raw counts without rebuilding the (expensive) label nodes.
    const positions: KeyPosition[] = useMemo(() => {
        if (!heatmapEnabled) return basePositions
        let max = 0
        basePositions.forEach((p, idx) => {
            if (p.encoder) return
            const c =
                heatmapCounts[`${selectedPhysicalLayoutIndex}:${idx}`] ?? 0
            if (c > max) max = c
        })
        return basePositions.map((p, idx) => {
            if (p.encoder) return p
            const c =
                heatmapCounts[`${selectedPhysicalLayoutIndex}:${idx}`] ?? 0
            return {
                ...p,
                heat: max > 0 ? c / max : null,
                pressCount: c,
            }
        })
    }, [
        basePositions,
        heatmapEnabled,
        heatmapCounts,
        selectedPhysicalLayoutIndex,
    ])

    return (
        <>
            {layouts && keymap && (
                <div className="p-2 col-start-2 row-start-1 items-center justify-center relative min-w-0 flex h-full bg-accent">
                    <PhysicalLayoutCanvas
                        positions={positions}
                        oneU={48}
                        hoverZoom={true}
                        zoom="auto"
                        pannable
                        tooltips
                        selectedPosition={selectedKeyPosition}
                        onPositionClicked={setSelectedKeyPosition}
                        selectedEncoder={selectedEncoder}
                        onEncoderClicked={(slot, dir): void =>
                            setSelectedEncoder?.({ slot, dir })
                        }
                        onPositionContextMenu={handlePositionContextMenu}
                        pressedKeys={liveView ? pressedKeys : EMPTY_KEYS}
                    />
                    <StageControls
                        heatmapEnabled={heatmapEnabled}
                        onToggleHeatmap={toggleHeatmap}
                        onResetHeat={resetHeat}
                        liveView={liveView}
                        onToggleLive={() => setLiveView((v) => !v)}
                    />
                    <KeyContextMenu
                        open={contextMenu !== null}
                        x={contextMenu?.x ?? 0}
                        y={contextMenu?.y ?? 0}
                        items={
                            contextMenu === null
                                ? []
                                : [
                                      {
                                          label: 'Copy binding',
                                          onSelect: () =>
                                              handleCopy(contextMenu.position),
                                      },
                                      {
                                          label: clipboardAction
                                              ? 'Paste binding'
                                              : 'Paste binding (empty)',
                                          disabled: !clipboardAction,
                                          onSelect: () =>
                                              handlePaste(contextMenu.position),
                                      },
                                  ]
                        }
                        onClose={() => setContextMenu(null)}
                    />
                </div>
            )}
        </>
    )
}

interface StageControlsProps {
    heatmapEnabled: boolean
    onToggleHeatmap: () => void
    onResetHeat: () => void
    liveView: boolean
    onToggleLive: () => void
}

const pillBase =
    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur transition-colors'
const pillOn = 'border-primary/50 bg-primary/15 text-primary'
const pillOff =
    'border-border bg-background/80 text-muted-foreground hover:text-foreground'

function StageControls({
    heatmapEnabled,
    onToggleHeatmap,
    onResetHeat,
    liveView,
    onToggleLive,
}: StageControlsProps): JSX.Element {
    return (
        <>
            <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
                <button
                    type="button"
                    onClick={onToggleHeatmap}
                    aria-pressed={heatmapEnabled}
                    className={`${pillBase} ${heatmapEnabled ? pillOn : pillOff}`}
                >
                    <Flame className="size-3.5" /> Heatmap
                </button>
                {heatmapEnabled && (
                    <div className="flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
                        <span>Cold</span>
                        <span
                            className="h-2 w-16 rounded-full"
                            style={{
                                background:
                                    'linear-gradient(90deg, oklch(0.32 0.06 250), oklch(0.5 0.16 135), oklch(0.62 0.22 20))',
                            }}
                        />
                        <span>Hot</span>
                        <button
                            type="button"
                            onClick={onResetHeat}
                            title="Reset press counts"
                            aria-label="Reset press counts"
                            className="ml-0.5 rounded-full p-0.5 hover:text-foreground"
                        >
                            <RotateCcw className="size-3" />
                        </button>
                    </div>
                )}
                <button
                    type="button"
                    onClick={onToggleLive}
                    aria-pressed={liveView}
                    className={`${pillBase} ${liveView ? pillOn : pillOff}`}
                >
                    <Activity className="size-3.5" /> Live
                </button>
            </div>
            {liveView && (
                <div className="absolute top-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-green-500/40 bg-green-500/15 px-2.5 py-1 text-[11px] font-semibold text-green-600 dark:text-green-400">
                    <span className="relative flex size-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-green-500" />
                    </span>
                    LIVE
                </div>
            )}
        </>
    )
}
