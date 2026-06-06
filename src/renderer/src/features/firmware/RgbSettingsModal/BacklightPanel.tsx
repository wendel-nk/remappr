// pattern-check: skip — backlight effect-grid panel; local state + facade I/O, no abstraction
import { useEffect, useState } from 'react'
import {
    Activity,
    Ban,
    Binary,
    Blend,
    Circle,
    CloudRain,
    Disc,
    Disc3,
    Droplets,
    Fan,
    Flame,
    Grid3x3,
    Layers,
    type LucideIcon,
    MoveHorizontal,
    Rainbow,
    RefreshCw,
    Sparkles,
    Square,
    Tornado,
    Waves,
    Zap,
} from 'lucide-react'

import type { RgbApi, RgbEffectState } from '@firmware/service'
import { COLORLESS_EFFECT } from '@firmware/lighting'
import { saveWithToast } from '@/lib/saveWithToast'
import useLightingStore from '@/stores/lightingStore'
import { lightingFromDevice } from '@/features/lighting/engine'

import { ColorPicker } from './ColorPicker'

interface Props {
    rgb: RgbApi
}

// pattern-check: skip — keyword→icon resolver, presentational helper, no abstraction
// Resolve an effect glyph by keyword — covers every subsystem's effect names.
// Ordered: more specific patterns first.
const ICON_RULES: [RegExp, LucideIcon][] = [
    [/none|^off$/i, Ban],
    [/per[\s-]?key/i, Grid3x3],
    [/^mix/i, Layers],
    [/rainbow|spectrum/i, Rainbow],
    [/spiral|swirl/i, Tornado],
    [/pinwheel/i, Fan],
    [/heatmap/i, Flame],
    [/reactive/i, Zap],
    [/splash/i, Droplets],
    [/rain/i, CloudRain],
    [/beacon/i, Disc],
    [/band/i, Disc3],
    [/twinkle|starlight|pixel|christmas|jellybean/i, Sparkles],
    [/digital|test/i, Binary],
    [/wave|snake|river|flow/i, Waves],
    [/gradient/i, Blend],
    [/knight|alternating/i, MoveHorizontal],
    [/cycle/i, RefreshCw],
    [/breath/i, Activity],
    [/solid|static|color|alphas/i, Square],
]

const iconFor = (name: string): LucideIcon =>
    ICON_RULES.find(([re]) => re.test(name))?.[1] ?? Circle

export function BacklightPanel({ rgb }: Props): JSX.Element {
    const [state, setState] = useState<RgbEffectState | null>(null)
    const setDeviceLighting = useLightingStore((s) => s.setDevice)

    // Mirror device effect state into the on-screen glow (sim derived from settings).
    const syncGlow = (st: RgbEffectState): void => {
        const cat = rgb.effectCatalog
        if (!cat) return
        setDeviceLighting(
            lightingFromDevice(st, cat.effects[st.mode] ?? '', cat),
        )
    }

    useEffect(() => {
        if (!rgb.getEffect) return
        let cancelled = false
        ;(async () => {
            const r = await saveWithToast(
                () => rgb.getEffect!(),
                null,
                'Read backlight failed',
            )
            if (!cancelled && r) {
                setState(r)
                syncGlow(r)
            }
        })()
        return (): void => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rgb])

    const cat = rgb.effectCatalog
    if (!cat || !rgb.getEffect || !rgb.setEffect) {
        return (
            <div className="text-xs text-muted-foreground">
                Backlight effects not exposed by this firmware build.
            </div>
        )
    }

    // Apply live so the keyboard updates as you tweak; modal footer persists.
    const apply = (patch: Partial<RgbEffectState>): void => {
        if (!state) return
        const next = { ...state, ...patch }
        setState(next)
        syncGlow(next)
        void rgb.setEffect!(next)
    }

    const names = cat.effects
    // Colour picker shows only for colour-capable subsystems on a fixed-hue effect.
    const usesColor =
        !!state &&
        cat.hasColor &&
        !COLORLESS_EFFECT.test(names[state.mode] ?? '')

    return (
        <div className="flex flex-col gap-4">
            {/* effect grid */}
            <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Effect
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {names.map((name, mode) => {
                        const Icon = iconFor(name)
                        const active = state?.mode === mode
                        return (
                            <button
                                key={name}
                                type="button"
                                onClick={(): void => apply({ mode })}
                                data-active={active}
                                className="flex flex-col items-center gap-1.5 rounded-xl border bg-background px-2 py-3 text-center text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground data-[active=true]:border-primary data-[active=true]:bg-primary/10 data-[active=true]:text-foreground"
                            >
                                <Icon className="size-4" />
                                <span className="leading-tight">{name}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {state && (
                <>
                    {/* brightness + speed */}
                    {(
                        [
                            ['Brightness', 'brightness'],
                            ...(cat.hasSpeed
                                ? ([['Speed', 'speed']] as const)
                                : []),
                        ] as const
                    ).map(([label, key]) => (
                        <label key={key} className="flex flex-col gap-1.5">
                            <span className="flex items-center justify-between text-[13px] font-semibold">
                                {label}
                                <span className="font-mono text-xs text-muted-foreground">
                                    {Math.round((state[key] / 255) * 100)}%
                                </span>
                            </span>
                            <input
                                type="range"
                                min={0}
                                max={255}
                                value={state[key]}
                                onChange={(e): void =>
                                    apply({
                                        [key]: Number(e.currentTarget.value),
                                    })
                                }
                                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
                            />
                        </label>
                    ))}

                    {/* colour (effects that use a single hue) */}
                    {usesColor && (
                        <div>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                Colour
                            </p>
                            <ColorPicker
                                value={state.color}
                                onChange={(color): void => apply({ color })}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
