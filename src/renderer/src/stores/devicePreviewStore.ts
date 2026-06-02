// Pattern check: no GoF pattern (-) — rejected — persisted zustand snapshot map mirroring
// heatmapStore; serializable per-device layout cache, no abstraction.
import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import type { KeyCategory } from '@/lib/keymap/keyCategory'

/** One key of a cached base-layer preview — fully serializable (no ReactNodes). */
export interface PreviewKey {
    x: number
    y: number
    width: number
    height: number
    r?: number
    rx?: number
    ry?: number
    category: KeyCategory
    /** Resolved tap glyph, e.g. "Q". */
    tap: string
    /** Resolved hold glyph / layer name, when the key is a hold-tap. */
    hold?: string
    /** Action-type tag, e.g. "Key Press" / "Mod-Tap". */
    action?: string
}

/**
 * A snapshot of a device's base layer, captured while connected and shown on its
 * start-page card after disconnect. Keyed by the device's stable list id (falling
 * back to the firmware-reported name for pair-new flows that have no list id).
 */
export interface DevicePreviewSnapshot {
    name: string
    communication: 'serial' | 'ble' | 'hid'
    keyCount: number
    layerCount: number
    keys: PreviewKey[]
    savedAt: number
}

interface DevicePreviewState {
    snapshots: Record<string, DevicePreviewSnapshot>
    saveSnapshot: (key: string, snapshot: DevicePreviewSnapshot) => void
    clear: (key: string) => void
}

const useDevicePreviewStore = create<DevicePreviewState>()(
    devtools(
        persist(
            (set) => ({
                snapshots: {},
                saveSnapshot: (key, snapshot) =>
                    set((s) => ({
                        snapshots: { ...s.snapshots, [key]: snapshot },
                    })),
                clear: (key) =>
                    set((s) => {
                        const next = { ...s.snapshots }
                        delete next[key]
                        return { snapshots: next }
                    }),
            }),
            {
                name: 'device-preview-store',
                storage: createJSONStorage(() => localStorage),
                partialize: (s) => ({ snapshots: s.snapshots }),
            },
        ),
    ),
)

export default useDevicePreviewStore
