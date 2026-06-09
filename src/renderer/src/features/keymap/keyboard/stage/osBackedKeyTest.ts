// Pattern check: Adapter (Tier 1) — applied — adapts the window keyboard-event
// source to the KeyTestApi matrix-report interface, so the deviceless mock can
// drive Key Test through the same facade path a real switch-matrix would. Real
// adapters replace this with a genuine hardware channel.
import type { KeyTestApi } from '@firmware/service'
import {
    findKeyPositionForDomKey,
    type KeypressDetectionConfig,
} from '@/lib/keypress/keypressDetector'

/**
 * Build a {@link KeyTestApi} backed by OS keyboard events for the mock/demo
 * service. There's no physical matrix, so each window keydown/keyup is mapped to
 * a board position (via the same detector the live-view fallback uses) and pushed
 * as a synthetic matrix-state report. `getConfig` is read at event time so layer
 * / layout changes are always reflected; it returns null when no keymap is ready.
 */
export function createOsBackedKeyTest(
    getConfig: () => KeypressDetectionConfig | null,
): KeyTestApi {
    const pressed = new Set<number>()
    return {
        onMatrixState(cb) {
            const onDown = (e: KeyboardEvent): void => {
                const t = e.target
                if (
                    t instanceof HTMLInputElement ||
                    t instanceof HTMLTextAreaElement
                )
                    return
                const cfg = getConfig()
                if (!cfg) return
                const pos = findKeyPositionForDomKey(e.code, cfg)
                if (pos === null || pressed.has(pos)) return
                pressed.add(pos)
                cb(new Set(pressed))
            }
            const onUp = (e: KeyboardEvent): void => {
                const cfg = getConfig()
                if (!cfg) return
                const pos = findKeyPositionForDomKey(e.code, cfg)
                if (pos === null || !pressed.delete(pos)) return
                cb(new Set(pressed))
            }
            window.addEventListener('keydown', onDown)
            window.addEventListener('keyup', onUp)
            return () => {
                window.removeEventListener('keydown', onDown)
                window.removeEventListener('keyup', onUp)
                pressed.clear()
            }
        },
        readMatrix: async () => new Set(pressed),
    }
}
