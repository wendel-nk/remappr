// pattern-check: skip — live-press detection + heat counting extracted from KeyboardView
/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardService } from '@firmware'
import type { Keymap } from '@firmware/types'
import useHeatmapStore from '@/stores/heatmapStore'
import useKeyTestStore from '@/stores/keyTestStore'
import { useKeypressDetection } from '@/hooks/use-keypress-detection'
import type { KeypressDetectionConfig } from '@/lib/keypress/keypressDetector'

interface Inputs {
    layouts: KeypressDetectionConfig['layouts'] | undefined
    keymap: Keymap | undefined
    effectiveLayerIndex: number
    selectedPhysicalLayoutIndex: number
    /** Live service, for the hardware matrix channel (Key Test). */
    service?: KeyboardService | null
    /** Key Test mode active — prefer the hardware matrix where the firmware
     *  exposes `service.keyTest`, and accumulate the `seen` set. */
    keyTestActive?: boolean
}

/** Set of currently-pressed key positions (drives the live-view flash), and the
 *  side-effect of incrementing heatmap counts on each leading-edge press. In Key
 *  Test mode it prefers the firmware's live switch-matrix channel (catching keys
 *  that emit no keycode); otherwise it sources presses from OS keyboard events. */
export function useLivePresses({
    layouts,
    keymap,
    effectiveLayerIndex,
    selectedPhysicalLayoutIndex,
    service,
    keyTestActive = false,
}: Inputs): Set<number> {
    const incrementHeat = useHeatmapStore((s) => s.increment)
    const markSeen = useKeyTestStore((s) => s.markSeen)
    const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set())
    // Mirror of pressedKeys for the heat-count repeat guard (keydown auto-repeats).
    const pressedRef = useRef<Set<number>>(new Set())

    // Use the firmware's raw matrix channel only while Key Test is active and the
    // adapter actually exposes it; otherwise the OS-event detector drives presses.
    const matrix = keyTestActive ? service?.keyTest : undefined
    const useMatrix = !!matrix

    const noteLeadingEdge = useCallback(
        (keyPosition: number): void => {
            if (!pressedRef.current.has(keyPosition)) {
                pressedRef.current.add(keyPosition)
                // A Key Test sweep isn't real typing — accumulate `seen`, but
                // don't pollute the typing-load heatmap with diagnostic presses.
                if (keyTestActive) markSeen(keyPosition)
                else
                    incrementHeat(
                        `${selectedPhysicalLayoutIndex}:${keyPosition}`,
                    )
            }
        },
        [incrementHeat, markSeen, keyTestActive, selectedPhysicalLayoutIndex],
    )

    // OS-event path (disabled when reading the hardware matrix).
    const keypressConfig: KeypressDetectionConfig | null = useMemo(
        () =>
            !useMatrix && layouts && keymap
                ? {
                      layouts,
                      keymap,
                      selectedLayerIndex: effectiveLayerIndex,
                      selectedPhysicalLayoutIndex,
                  }
                : null,
        [
            useMatrix,
            layouts,
            keymap,
            effectiveLayerIndex,
            selectedPhysicalLayoutIndex,
        ],
    )

    const handleKeyPressed = useCallback(
        (keyPosition: number) => {
            noteLeadingEdge(keyPosition)
            setPressedKeys((prev) => new Set(prev).add(keyPosition))
        },
        [noteLeadingEdge],
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

    // Hardware matrix path: subscribe only while active (the poll is hot, HID is
    // serialized). The adapter pushes the full pressed-position set on each change;
    // we diff it to count leading edges and mark `seen`.
    useEffect(() => {
        if (!matrix) return
        const unsubscribe = matrix.onMatrixState((pressed) => {
            for (const pos of pressed) noteLeadingEdge(pos)
            // Released positions clear from the repeat guard so a re-press counts.
            for (const pos of pressedRef.current) {
                if (!pressed.has(pos)) pressedRef.current.delete(pos)
            }
            setPressedKeys(new Set(pressed))
        })
        return () => {
            unsubscribe()
            pressedRef.current = new Set()
            setPressedKeys(new Set())
        }
    }, [matrix, noteLeadingEdge])

    useEffect(() => {
        pressedRef.current = new Set()
        setPressedKeys(new Set())
    }, [effectiveLayerIndex, selectedPhysicalLayoutIndex])

    return pressedKeys
}
