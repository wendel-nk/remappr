// pattern-check: skip — demo binding of the shared RgbControls to the sim store
//
// Manual RGB-lighting controls shown in the RGB modal when no RGB-capable keyboard
// is connected (demo mode / non-RGB boards). Binds the shared <RgbControls> to the
// persisted sim store; the keyboard stage reflects it live through the glow engine.
// When a device IS connected the modal shows <DeviceRgbControls> instead, which
// drives the keyboard and mirrors its settings to the same glow.
import useLightingStore from '@/stores/lightingStore'
import {
    LIGHTING_EFFECTS,
    type LightingEffect,
} from '@/features/lighting/engine'

import { RgbControls, type RgbControlsModel } from './RgbControls'

export function SimulationPanel(): JSX.Element {
    const effect = useLightingStore((s) => s.effect)
    const bright = useLightingStore((s) => s.bright)
    const speed = useLightingStore((s) => s.speed)
    const hue = useLightingStore((s) => s.hue)
    const sat = useLightingStore((s) => s.sat)
    const perKey = useLightingStore((s) => s.perKey)
    const underglow = useLightingStore((s) => s.underglow)
    const backlight = useLightingStore((s) => s.backlight)
    const set = useLightingStore((s) => s.setLighting)
    const reset = useLightingStore((s) => s.reset)

    // hue is irrelevant for the spatial multi-hue effects (they spread across X).
    const hueLess = effect === 'rainbow' || effect === 'swirl'

    const model: RgbControlsModel = {
        effects: LIGHTING_EFFECTS,
        effectIndex: Math.max(0, LIGHTING_EFFECTS.indexOf(effect)),
        brightness: bright,
        saturation: sat,
        speed,
        hue,
        hasColor: !hueLess && effect !== 'off',
        hasSpeed: effect !== 'off',
    }

    return (
        <RgbControls
            model={model}
            note="No RGB keyboard connected — these controls drive the on-screen simulation only."
            onEffect={(i) =>
                set({ effect: LIGHTING_EFFECTS[i] as LightingEffect })
            }
            onChange={(patch) =>
                set({
                    ...(patch.brightness !== undefined && {
                        bright: patch.brightness,
                    }),
                    ...(patch.saturation !== undefined && {
                        sat: patch.saturation,
                    }),
                    ...(patch.speed !== undefined && { speed: patch.speed }),
                    ...(patch.hue !== undefined && { hue: patch.hue }),
                })
            }
            onReset={reset}
            toggles={{
                underglow,
                backlight,
                perKey,
                onToggle: (patch) => set(patch),
            }}
        />
    )
}
