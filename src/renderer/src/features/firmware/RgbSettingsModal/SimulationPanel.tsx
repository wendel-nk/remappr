// pattern-check: skip — presentational manual-sim controls bound to lightingStore
//
// Manual RGB-lighting simulation controls, shown in the RGB modal when no
// RGB-capable keyboard is connected (demo mode / non-RGB boards). Edits the
// persisted sim store; the keyboard stage reflects it live through the glow engine.
// When a device IS connected the modal shows the device panels instead and the glow
// mirrors the keyboard's settings (the on-screen glow is always a simulation —
// firmware doesn't report per-key colours).
import useLightingStore from '@/stores/lightingStore'
import {
    LIGHTING_EFFECTS,
    type LightingEffect,
} from '@/features/lighting/engine'

// hues for the swatch row (base hues; the multi-hue effects ignore them).
const HUE_SWATCHES: number[] = [25, 90, 152, 250, 286, 320]

function Slider({
    label,
    value,
    onChange,
    suffix = '%',
    min = 0,
    max = 100,
}: {
    label: string
    value: number
    onChange: (v: number) => void
    suffix?: string
    min?: number
    max?: number
}): JSX.Element {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-[13px] font-semibold">
                {label}
                <span className="font-mono text-xs text-muted-foreground">
                    {value}
                    {suffix}
                </span>
            </span>
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Number(e.currentTarget.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
            />
        </label>
    )
}

function ToggleRow({
    on,
    onToggle,
    label,
}: {
    on: boolean
    onToggle: (v: boolean) => void
    label: string
}): JSX.Element {
    return (
        <label className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-2.5 py-2">
            <span className="text-[13px] font-medium">{label}</span>
            <input
                type="checkbox"
                checked={on}
                onChange={(e) => onToggle(e.currentTarget.checked)}
                className="size-4 accent-primary"
            />
        </label>
    )
}

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

    return (
        <div className="flex flex-col gap-4 text-sm">
            <p className="text-xs text-muted-foreground">
                No RGB keyboard connected — these controls drive the on-screen
                simulation only.
            </p>

            {/* Effect */}
            <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Effect
                </p>
                <div className="flex flex-wrap gap-1.5">
                    {LIGHTING_EFFECTS.map((e) => {
                        const on = effect === e
                        return (
                            <button
                                key={e}
                                type="button"
                                onClick={() =>
                                    set({ effect: e as LightingEffect })
                                }
                                data-active={on}
                                className="rounded-md border bg-background px-2.5 py-1 text-[11px] font-semibold capitalize text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground data-[active=true]:border-primary data-[active=true]:bg-primary/10 data-[active=true]:text-foreground"
                            >
                                {e}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Colour */}
            <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Colour
                </p>
                <div className="flex items-center gap-1.5">
                    {HUE_SWATCHES.map((h) => {
                        const on = !hueLess && hue === h
                        return (
                            <button
                                key={h}
                                type="button"
                                aria-label={`Hue ${h}`}
                                onClick={() => set({ hue: h })}
                                className="size-[26px] rounded-md p-0"
                                style={{
                                    border: `2px solid ${on ? 'var(--foreground)' : 'transparent'}`,
                                    background: `oklch(0.7 0.2 ${h})`,
                                    opacity: hueLess ? 0.4 : 1,
                                }}
                            />
                        )
                    })}
                </div>
                {hueLess ? (
                    <p className="mt-1.5 text-[10.5px] text-muted-foreground">
                        {effect === 'swirl' ? 'Swirl' : 'Rainbow'} spreads every
                        hue across the board.
                    </p>
                ) : (
                    <div className="mt-2">
                        <Slider
                            label="Hue"
                            value={hue}
                            onChange={(v) => set({ hue: v })}
                            suffix="°"
                            max={360}
                        />
                    </div>
                )}
            </div>

            {/* Sliders */}
            <div className="flex flex-col gap-3">
                <Slider
                    label="Brightness"
                    value={bright}
                    onChange={(v) => set({ bright: v })}
                />
                <Slider
                    label="Saturation"
                    value={sat}
                    onChange={(v) => set({ sat: v })}
                />
                <Slider
                    label="Speed"
                    value={speed}
                    onChange={(v) => set({ speed: v })}
                />
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-1.5">
                <ToggleRow
                    on={underglow}
                    onToggle={(v) => set({ underglow: v })}
                    label="RGB underglow"
                />
                <ToggleRow
                    on={backlight}
                    onToggle={(v) => set({ backlight: v })}
                    label="Per-key backlight"
                />
                <ToggleRow
                    on={perKey}
                    onToggle={(v) => set({ perKey: v })}
                    label="Per-key colour"
                />
            </div>

            <button
                type="button"
                onClick={reset}
                className="mr-auto text-xs text-muted-foreground hover:text-foreground"
            >
                Reset to defaults
            </button>
        </div>
    )
}
