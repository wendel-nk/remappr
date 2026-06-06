// pattern-check: skip — live-press detection + heat counting extracted from KeyboardView
/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Keymap } from '@firmware/types'
import useHeatmapStore from '@/stores/heatmapStore'
import { useKeypressDetection } from '@/hooks/use-keypress-detection'
import type { KeypressDetectionConfig } from '@/lib/keypress/keypressDetector'

interface Inputs {
    layouts: KeypressDetectionConfig['layouts'] | undefined
    keymap: Keymap | undefined
    effectiveLayerIndex: number
    selectedPhysicalLayoutIndex: number
}

/** Set of currently-pressed key positions (drives the live-view flash), and the
 *  side-effect of incrementing heatmap counts on each leading-edge press. */
export function useLivePresses({
    layouts,
    keymap,
    effectiveLayerIndex,
    selectedPhysicalLayoutIndex,
}: Inputs): Set<number> {
    const incrementHeat = useHeatmapStore((s) => s.increment)
    const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set())
    // Mirror of pressedKeys for the heat-count repeat guard (keydown auto-repeats).
    const pressedRef = useRef<Set<number>>(new Set())

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

    return pressedKeys
}
