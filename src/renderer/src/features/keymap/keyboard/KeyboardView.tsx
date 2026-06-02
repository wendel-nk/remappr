/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { produce } from 'immer'
import { toast } from 'sonner'
import { ArrowRight, Eraser, Layers, RotateCcw, Wand2, X } from 'lucide-react'
import type { ActionType, KeyAction, Keymap } from '@firmware/types'
import {
    type ClickModifiers,
    type KeyPosition,
    PhysicalLayoutCanvas,
} from './PhysicalLayoutCanvas'
import { HidUsageLabel } from './HidUsageLabel'
import type { HoldTapLabels } from './KeyButton'
import { KeyContextMenu } from './KeyContextMenu'
import { LayerColorRail } from './LayerColorRail'
import { CommandAssign } from './CommandAssign'
import {
    type KeyActionDraft,
    KeyActionPicker,
} from '@/features/actions/KeyActionPicker'
import { Modal } from '@/ui/modal'
import type { WorkspaceMode } from '@/stores/userSettingsStore'
import type { CatalogEntry } from '@firmware/catalog/types'
import { useLayout } from '@/hooks/use-layouts'
import useConnectionStore from '@/stores/connectionStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import useKeymapStore from '@/stores/keymapStore'
import useClipboardStore from '@/stores/clipboardStore'
import useHeatmapStore from '@/stores/heatmapStore'
import useLoadStatsStore from '@/stores/loadStatsStore'
import useLiveViewStore from '@/stores/liveViewStore'
import useLayerPeekStore from '@/stores/layerPeekStore'
import undoRedoStore from '@/stores/undoRedoStore'
import { useKeypressDetection } from '@/hooks/use-keypress-detection'
import type { KeypressDetectionConfig } from '@/lib/keypress/keypressDetector'
import { resolveBindingLabels, type ResolvedHoldTapDescriptor } from '@firmware'
import {
    categoryForBinding,
    faceCategoryForBinding,
    layerAccent,
} from '@/lib/keymap/keyCategory'

/** Nearest key (by centre geometry) to `from` in a direction; null if none. */
function neighborInDirection(
    positions: KeyPosition[],
    from: number,
    dir: 'left' | 'right' | 'up' | 'down',
): number | null {
    const a = positions[from]
    if (!a || a.encoder) return null
    const acx = a.x + a.width / 2
    const acy = a.y + a.height / 2
    let best: number | null = null
    let bestScore = Infinity
    positions.forEach((p, i) => {
        if (i === from || p.encoder) return
        const dx = p.x + p.width / 2 - acx
        const dy = p.y + p.height / 2 - acy
        let primary: number
        let cross: number
        if (dir === 'left') {
            if (dx >= -0.1) return
            primary = -dx
            cross = Math.abs(dy)
        } else if (dir === 'right') {
            if (dx <= 0.1) return
            primary = dx
            cross = Math.abs(dy)
        } else if (dir === 'up') {
            if (dy >= -0.1) return
            primary = -dy
            cross = Math.abs(dx)
        } else {
            if (dy <= 0.1) return
            primary = dy
            cross = Math.abs(dx)
        }
        const score = primary + cross * 2
        if (score < bestScore) {
            bestScore = score
            best = i
        }
    })
    return best
}

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
    multiSelection: Set<number>
    setMultiSelection: (next: Set<number>) => void
    workspace: WorkspaceMode
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
    multiSelection,
    setMultiSelection,
    workspace,
}: KeyboardViewProps): JSX.Element {
    const { layouts, selectedPhysicalLayoutIndex } = useLayout()
    const { selectedLayerIndex, setSelectedLayerIndex } =
        useLayerSelectionStore()
    const { service } = useConnectionStore()
    const codec = useConnectionStore((s) => s.service?.codec)
    const peekLayerIndex = useLayerPeekStore((s) => s.peekLayerIndex)

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

    // Layer rendered on the stage: the hover-peeked layer if any, else the real selection.
    const displayLayerIndex = useMemo(() => {
        if (peekLayerIndex == null || !keymap) return effectiveLayerIndex
        return Math.min(Math.max(0, peekLayerIndex), keymap.layers.length - 1)
    }, [peekLayerIndex, keymap, effectiveLayerIndex])
    const isPeeking =
        peekLayerIndex != null && displayLayerIndex !== effectiveLayerIndex

    // Action types for the multi-assign picker + transparent ("clear") lookup.
    const [actionTypes, setActionTypes] = useState<ActionType[]>([])
    useEffect(() => {
        if (!service) {
            setActionTypes([])
            return
        }
        let cancelled = false
        service.listActionTypes().then((types) => {
            if (!cancelled) setActionTypes(types)
        })
        return (): void => {
            cancelled = true
        }
    }, [service])

    // Anchor for shift-range selection; assign-to-many modal + command palette visibility.
    const anchorRef = useRef<number | null>(null)
    const [assignOpen, setAssignOpen] = useState(false)
    const [paletteOpen, setPaletteOpen] = useState(false)

    const heatmapEnabled = useHeatmapStore((s) => s.enabled)
    const heatmapCounts = useHeatmapStore((s) => s.counts)
    const incrementHeat = useHeatmapStore((s) => s.increment)
    const resetHeat = useHeatmapStore((s) => s.reset)

    // Heatmap + live toggles now live in the header toolbar; the stage only reflects state.
    const liveView = useLiveViewStore((s) => s.enabled)

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
            displayLayerIndex,
        ).map((p) => ({
            id: p.id,
            header: p.header,
            actionLabel: p.actionLabel,
            holdTap: p.holdTap ? holdTapToLabels(p.holdTap) : undefined,
            // Face tint follows the tap key; the header tag + hold legend follow
            // the hold/function category. A home-row mod is thus a neutral alpha
            // cap with a violet "Mod-Tap" tag — matching the design.
            category: faceCategoryForBinding({
                actionLabel: p.actionLabel,
                bindingParam1: p.bindingParam1,
                actionTypeName: p.actionTypeName,
                outOfRange: p.outOfRange,
                isHoldTap: !!p.holdTap,
                holdIsLayer: p.holdTap?.holdNodeKind === 'layer',
            }),
            accentCategory: categoryForBinding({
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

        const encoderActions = keymap.layers[displayLayerIndex]?.encoders
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
    }, [layouts, keymap, selectedPhysicalLayoutIndex, displayLayerIndex])

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

    // Pattern check: no GoF pattern (-) — rejected — multi-key dispatch is a loop over
    // service.setKey wrapped in one undo entry; selection/shortcut handlers are event
    // plumbing with a pure geometry helper. No GoF abstraction or polymorphism fits.
    const keyCount = keymap?.layers[effectiveLayerIndex]?.keys.length ?? 0

    // Single click selects (opens the inspector); ⌘/ctrl-click toggles and shift-click
    // ranges into a multi-selection. Multi and single selection are mutually exclusive.
    const handlePositionClicked = useCallback(
        (position: number, mods?: ClickModifiers): void => {
            if (position >= keyCount) {
                setSelectedKeyPosition(position)
                return
            }
            if (mods?.shiftKey && anchorRef.current != null) {
                const a = anchorRef.current
                const lo = Math.min(a, position)
                const hi = Math.max(a, position)
                const next = new Set(multiSelection)
                if (selectedKeyPosition != null) next.add(selectedKeyPosition)
                for (let i = lo; i <= hi; i++) if (i < keyCount) next.add(i)
                setSelectedKeyPosition(undefined)
                setMultiSelection(next)
            } else if (mods && (mods.metaKey || mods.ctrlKey)) {
                const next = new Set(multiSelection)
                if (selectedKeyPosition != null) next.add(selectedKeyPosition)
                if (next.has(position)) next.delete(position)
                else next.add(position)
                anchorRef.current = position
                setSelectedKeyPosition(undefined)
                setMultiSelection(next)
            } else {
                anchorRef.current = position
                if (multiSelection.size > 0) setMultiSelection(new Set())
                setSelectedKeyPosition(position)
                // Command workspace: clicking a key opens the assign palette.
                if (workspace === 'command') setPaletteOpen(true)
            }
        },
        [
            keyCount,
            multiSelection,
            selectedKeyPosition,
            setSelectedKeyPosition,
            setMultiSelection,
            workspace,
        ],
    )

    // Positions a bulk action applies to: the multi-selection, else the single selection.
    const targetPositions = useMemo(() => {
        const list =
            multiSelection.size > 0
                ? [...multiSelection]
                : selectedKeyPosition != null
                  ? [selectedKeyPosition]
                  : []
        return list.filter((p) => p < keyCount)
    }, [multiSelection, selectedKeyPosition, keyCount])

    // Set the same action on many positions as one undoable step.
    const dispatchSetKeys = useCallback(
        (positions: number[], action: KeyAction): void => {
            if (!service || !keymap || positions.length === 0) return
            const layer = effectiveLayerIndex
            const layerEntry = keymap.layers[layer]
            if (!layerEntry) return
            const layerId = layerEntry.id
            const olds = new Map(positions.map((p) => [p, layerEntry.keys[p]]))
            doIt?.(async (): Promise<() => Promise<void>> => {
                try {
                    for (const p of positions) {
                        await service.setKey(layerId, p, action)
                    }
                    setKeymapInStore(
                        (prev) =>
                            prev &&
                            produce(prev, (d) => {
                                for (const p of positions)
                                    d.layers[layer].keys[p] = action
                            }),
                    )
                } catch (e) {
                    toast.error('Failed to set actions')
                    console.error('multi setKey failed', e)
                }
                return async (): Promise<void> => {
                    try {
                        for (const p of positions) {
                            const old = olds.get(p)
                            if (old) await service.setKey(layerId, p, old)
                        }
                        setKeymapInStore(
                            (prev) =>
                                prev &&
                                produce(prev, (d) => {
                                    for (const p of positions) {
                                        const old = olds.get(p)
                                        if (old) d.layers[layer].keys[p] = old
                                    }
                                }),
                        )
                    } catch (e) {
                        console.error('Failed to undo multi setKey', e)
                    }
                }
            })
        },
        [service, keymap, effectiveLayerIndex, doIt, setKeymapInStore],
    )

    const transparentType = useMemo(
        () => actionTypes.find((t) => /transparent/i.test(t.displayName ?? '')),
        [actionTypes],
    )

    const handleClearBindings = useCallback((): void => {
        if (!service || !transparentType || targetPositions.length === 0) return
        dispatchSetKeys(
            targetPositions,
            service.buildKeyAction(transparentType.id, []),
        )
    }, [service, transparentType, targetPositions, dispatchSetKeys])

    const handleAssign = useCallback(
        (draft: KeyActionDraft): void => {
            if (!service) return
            dispatchSetKeys(
                targetPositions,
                service.buildKeyAction(draft.kind, draft.params),
            )
            setAssignOpen(false)
        },
        [service, targetPositions, dispatchSetKeys],
    )

    const clearSelection = useCallback((): void => {
        setMultiSelection(new Set())
        setSelectedKeyPosition(undefined)
        setAssignOpen(false)
        setPaletteOpen(false)
    }, [setMultiSelection, setSelectedKeyPosition])

    // Key Press action type (single HID slot) used for command-palette quick assign.
    const keyPressType = useMemo(
        () =>
            actionTypes.find(
                (t) => t.slots.length === 1 && t.slots[0].kind === 'hid',
            ),
        [actionTypes],
    )

    // Build a KeyAction from a picked catalog entry and apply it to the targets.
    const handleAssignEntry = useCallback(
        (entry: CatalogEntry): void => {
            if (!service || targetPositions.length === 0) return
            const behaviorKind = entry.behaviorRef?.kind
            let action: KeyAction | null = null
            if (behaviorKind) {
                action = service.buildKeyAction(behaviorKind, [])
            } else if (keyPressType) {
                const enc = codec?.encode(entry.id)
                if (enc)
                    action = service.buildKeyAction(keyPressType.id, [
                        enc.value,
                    ])
            }
            if (action) dispatchSetKeys(targetPositions, action)
            setPaletteOpen(false)
        },
        [service, codec, keyPressType, targetPositions, dispatchSetKeys],
    )

    const assignSeed = useMemo(
        () =>
            targetPositions.length > 0
                ? (keymap?.layers[effectiveLayerIndex]?.keys[
                      targetPositions[0]
                  ] ?? null)
                : null,
        [targetPositions, keymap, effectiveLayerIndex],
    )

    const layerList = useMemo(
        () =>
            keymap?.layers.map(({ id, name }, li) => ({
                id,
                name: name || li.toLocaleString(),
            })) ?? [],
        [keymap],
    )

    // Keyboard shortcuts: arrows move the single selection, ⌘K opens assign,
    // Backspace/Delete clears the binding(s), Escape clears the selection.
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent): void => {
            const t = e.target as HTMLElement | null
            const typing =
                !!t &&
                (t.tagName === 'INPUT' ||
                    t.tagName === 'TEXTAREA' ||
                    t.isContentEditable)
            if (e.key === 'Escape') {
                clearSelection()
                return
            }
            if (typing) return
            const meta = e.metaKey || e.ctrlKey
            if (meta && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault()
                if (targetPositions.length === 0) return
                if (workspace === 'command') setPaletteOpen(true)
                else setAssignOpen(true)
                return
            }
            if (assignOpen || paletteOpen) return
            if (e.key === 'Backspace' || e.key === 'Delete') {
                if (targetPositions.length > 0) {
                    e.preventDefault()
                    handleClearBindings()
                }
                return
            }
            const dirMap = {
                ArrowLeft: 'left',
                ArrowRight: 'right',
                ArrowUp: 'up',
                ArrowDown: 'down',
            } as const
            const dir = dirMap[e.key as keyof typeof dirMap]
            if (
                dir &&
                !meta &&
                selectedKeyPosition != null &&
                multiSelection.size === 0
            ) {
                const n = neighborInDirection(
                    positions,
                    selectedKeyPosition,
                    dir,
                )
                if (n != null) {
                    e.preventDefault()
                    anchorRef.current = n
                    setSelectedKeyPosition(n)
                }
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return (): void => window.removeEventListener('keydown', onKeyDown)
    }, [
        assignOpen,
        paletteOpen,
        workspace,
        targetPositions,
        selectedKeyPosition,
        multiSelection,
        positions,
        handleClearBindings,
        clearSelection,
        setSelectedKeyPosition,
    ])

    const layerName =
        keymap?.layers[displayLayerIndex]?.name || String(displayLayerIndex)

    return (
        <>
            {layouts && keymap && (
                <div
                    data-coach="board"
                    className="workbench-bg p-2 col-start-2 row-start-1 items-center justify-center relative min-w-0 flex h-full"
                >
                    {/* // pattern-check: skip — presentational stage overlays (glow, layer pill, multi-select bar, assign modal) */}
                    {/* Dotted workbench backdrop + soft radial glow is the .workbench-bg
                        class (incl. its masked ::before dot grid), ported from the design. */}
                    <PhysicalLayoutCanvas
                        positions={positions}
                        oneU={48}
                        hoverZoom={true}
                        zoom="auto"
                        pannable
                        tooltips
                        selectedPosition={selectedKeyPosition}
                        selectedPositions={multiSelection}
                        onPositionClicked={handlePositionClicked}
                        selectedEncoder={selectedEncoder}
                        onEncoderClicked={(slot, dir): void =>
                            setSelectedEncoder?.({ slot, dir })
                        }
                        onPositionContextMenu={handlePositionContextMenu}
                        pressedKeys={liveView ? pressedKeys : EMPTY_KEYS}
                    />
                    {/* Top-left cluster: current-layer pill (accent dot + glow)
                        plus the pulsing LIVE indicator, matching the design. */}
                    <div className="absolute top-3.5 left-4 z-10 flex items-center gap-2.5">
                        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-bold shadow-sm">
                            <span
                                aria-hidden
                                className="size-[9px] rounded-[3px]"
                                style={{
                                    background: layerAccent(displayLayerIndex),
                                    boxShadow: `0 0 8px ${layerAccent(displayLayerIndex)}`,
                                }}
                            />
                            {layerName}
                            <span className="text-xs font-medium text-muted-foreground">
                                layer
                            </span>
                        </span>
                        {liveView && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/40 bg-green-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.04em] text-green-600 dark:text-green-400">
                                <span className="relative flex size-[7px]">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                                    <span className="relative inline-flex size-[7px] rounded-full bg-green-500" />
                                </span>
                                LIVE
                            </span>
                        )}
                    </div>
                    {/* Hover-peek banner (top-centre), separate from the layer pill. */}
                    {isPeeking && (
                        <div className="absolute top-3.5 left-1/2 z-[16] inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 border-amber-500/50">
                            <Layers className="size-3.5" /> Previewing{' '}
                            {layerName}
                        </div>
                    )}
                    <StageControls
                        heatmapEnabled={heatmapEnabled}
                        onResetHeat={resetHeat}
                    />
                    {multiSelection.size > 0 && (
                        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background/90 px-2 py-1.5 shadow-lg backdrop-blur">
                            <span className="px-1.5 text-xs font-medium text-muted-foreground">
                                {multiSelection.size} selected
                            </span>
                            <button
                                type="button"
                                onClick={() => setAssignOpen(true)}
                                className="flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                            >
                                <Wand2 className="size-3.5" /> Assign
                            </button>
                            <button
                                type="button"
                                onClick={handleClearBindings}
                                disabled={!transparentType}
                                title="Clear bindings (Delete)"
                                className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-40"
                            >
                                <Eraser className="size-3.5" /> Clear
                            </button>
                            <button
                                type="button"
                                onClick={clearSelection}
                                aria-label="Dismiss selection"
                                title="Dismiss selection (Esc)"
                                className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    )}
                    {assignSeed && (
                        <Modal
                            opened={assignOpen}
                            onClose={() => setAssignOpen(false)}
                            title={`Assign to ${targetPositions.length} ${
                                targetPositions.length === 1 ? 'key' : 'keys'
                            }`}
                            xButton={true}
                            isDismissable={true}
                            showFooter={false}
                        >
                            <KeyActionPicker
                                action={assignSeed}
                                actionTypes={actionTypes}
                                layers={layerList}
                                onChange={handleAssign}
                            />
                        </Modal>
                    )}
                    {workspace === 'command' && (
                        <>
                            <LayerColorRail />
                            <CommandAssign
                                open={paletteOpen}
                                onOpenChange={setPaletteOpen}
                                targetCount={targetPositions.length}
                                onSelect={handleAssignEntry}
                            />
                        </>
                    )}
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

// pattern-check: skip — presentational refactor, strip toggle buttons from StageControls
interface StageControlsProps {
    heatmapEnabled: boolean
    onResetHeat: () => void
}

// pattern-check: skip — presentational legend, store read only, no abstraction
// Heatmap legend (top-centre, matching the design): Less→More gradient, a reset,
// and a "View load stats" link that opens the Typing-load modal. The on/off toggles
// live in the header toolbar (Flame / Zap); the stage only reflects state.
function StageControls({
    heatmapEnabled,
    onResetHeat,
}: StageControlsProps): JSX.Element | null {
    const openLoadStats = useLoadStatsStore((s) => s.setOpen)
    if (!heatmapEnabled) return null
    return (
        <div className="absolute top-3.5 left-1/2 z-[15] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[11px] font-semibold text-muted-foreground shadow-sm">
            <span>Less</span>
            <span
                className="h-2 w-[110px] rounded-full"
                style={{
                    background:
                        'linear-gradient(90deg, oklch(0.34 0.07 250), oklch(0.5 0.16 286), oklch(0.62 0.22 20))',
                }}
            />
            <span>More</span>
            <button
                type="button"
                onClick={onResetHeat}
                title="Reset press counts"
                aria-label="Reset press counts"
                className="ml-0.5 rounded-full p-0.5 hover:text-foreground"
            >
                <RotateCcw className="size-3" />
            </button>
            <span className="mx-0.5 h-3.5 w-px bg-border" />
            <button
                type="button"
                onClick={(): void => openLoadStats(true)}
                className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
            >
                View load stats
                <ArrowRight className="size-3" />
            </button>
        </div>
    )
}
