// pattern-check: skip — shared constant table + pure firmware-type mapper moved out
// of BuilderMetaForm so the extracted sections share them; no abstraction.
import { BUILDER_FIRMWARE_TARGETS } from '@firmware/config'

/** The keyboard "type" implied by the selected firmware targets. */
export function keyboardTypeFor(targets: string[]): {
    conn: string
    wireless: boolean
    label: string
} {
    const t = targets.length ? targets : ['qmk']
    const anyWireless = t.some(
        (id) => BUILDER_FIRMWARE_TARGETS.find((f) => f.id === id)?.wireless,
    )
    const names = t
        .map((id) => BUILDER_FIRMWARE_TARGETS.find((f) => f.id === id)?.name)
        .filter(Boolean)
    return {
        conn: anyWireless
            ? t.length > 1
                ? 'Wired + wireless'
                : 'Wireless (BLE)'
            : 'Wired (USB)',
        wireless: anyWireless,
        label: names.join(' + ') || 'Custom',
    }
}

export const LIGHTING_EFFECTS = [
    'solid',
    'breathe',
    'rainbow',
    'swirl',
    'gradient',
]
export const HUE_SWATCHES: (number | undefined)[] = [
    undefined,
    25,
    90,
    152,
    250,
    300,
]
