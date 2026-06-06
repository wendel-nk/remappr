// pattern-check: skip — RGB-glow wiring extracted from KeyboardView, no behavior change
import { useEffect, useMemo } from 'react'
import type { KeyboardService } from '@firmware/service'
import useLightingStore from '@/stores/lightingStore'
import {
    lightingFromDevice,
    lightingFromSim,
    type UnifiedLighting,
} from '@/features/lighting/engine'

/**
 * Resolves the editor/demo keyboard glow config. The on-screen glow is ALWAYS a
 * simulation (firmware doesn't report per-key colours). When a keyboard is
 * connected the glow is driven by its readable RGB settings (`device`); otherwise
 * the persisted manual sim store (edited in the RGB modal) drives it. The connect
 * read seeds `device` so the glow mirrors the keyboard before the modal is opened;
 * the modal pushes live updates as the user tweaks.
 */
export function useStageLighting(
    service: KeyboardService | null,
): UnifiedLighting {
    const deviceLighting = useLightingStore((s) => s.device)
    const setDeviceLighting = useLightingStore((s) => s.setDevice)
    const simEffect = useLightingStore((s) => s.effect)
    const simBright = useLightingStore((s) => s.bright)
    const simSpeed = useLightingStore((s) => s.speed)
    const simHue = useLightingStore((s) => s.hue)
    const simSat = useLightingStore((s) => s.sat)
    const simPerKey = useLightingStore((s) => s.perKey)
    const simUnder = useLightingStore((s) => s.underglow)
    const simBack = useLightingStore((s) => s.backlight)

    const simLighting = useMemo(
        () =>
            lightingFromSim({
                effect: simEffect,
                bright: simBright,
                speed: simSpeed,
                hue: simHue,
                sat: simSat,
                perKey: simPerKey,
                underglow: simUnder,
                backlight: simBack,
            }),
        [
            simEffect,
            simBright,
            simSpeed,
            simHue,
            simSat,
            simPerKey,
            simUnder,
            simBack,
        ],
    )

    useEffect(() => {
        const rgb = service?.rgb
        if (!rgb?.getEffect || !rgb.effectCatalog) {
            setDeviceLighting(null)
            return
        }
        const cat = rgb.effectCatalog
        let cancelled = false
        rgb.getEffect()
            .then((st) => {
                if (cancelled) return
                setDeviceLighting(
                    lightingFromDevice(st, cat.effects[st.mode] ?? '', cat),
                )
            })
            .catch(() => {})
        return (): void => {
            cancelled = true
        }
    }, [service, setDeviceLighting])

    return deviceLighting ?? simLighting
}
