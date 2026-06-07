// pattern-check: skip — session zustand slice caching the device's last-read RGB effect
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { RgbEffectState } from '@firmware/service'

/**
 * Cache of the connected keyboard's global RGB effect (brightness/effect/speed/
 * colour, device 0–255). Read ONCE on connect (HID is serialized + slow), then
 * reused by the on-screen glow and the RGB modal so opening the modal is instant
 * instead of firing four serial HID reads. Writes update it optimistically.
 */
interface RgbEffectStoreState {
    effect: RgbEffectState | null
    setEffect: (effect: RgbEffectState | null) => void
}

const useRgbEffectStore = create<RgbEffectStoreState>()(
    devtools((set) => ({
        effect: null,
        setEffect: (effect) => set({ effect }),
    })),
)

export default useRgbEffectStore
