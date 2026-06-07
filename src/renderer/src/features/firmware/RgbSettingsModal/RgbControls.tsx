// pattern-check: skip — presentational RGB controls; props in / callbacks out, no abstraction
//
// One RGB-lighting controls surface, shared by the demo simulation binding
// (SimulationPanel) and the connected-device binding (DeviceRgbControls). It only
// knows a normalized view model (effect list + index, 0–100 sliders, 0–360 hue) —
// never firmware bytes — so any source (sim store or device) drives the same UI.
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

// hues for the swatch row (base hues; multi-hue effects ignore them).
const HUE_SWATCHES: number[] = [25, 90, 152, 250, 286, 320]

// pattern-check: skip — keyword→icon resolver, presentational helper, no abstraction
// Resolve an effect glyph by keyword — covers every subsystem's effect names
// (ported from the old BacklightPanel). Ordered: more specific patterns first.
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

export interface RgbControlsModel {
    /** Selectable effect names in display order. */
    effects: readonly string[]
    /** Index into `effects` of the active effect. */
    effectIndex: number
    brightness: number // 0..100
    saturation: number // 0..100
    speed: number // 0..100
    hue: number // 0..360
    /** Colour controls relevant for the current effect (hue/sat). */
    hasColor: boolean
    /** Animation speed adjustable. */
    hasSpeed: boolean
}

export interface RgbControlsToggles {
    underglow: boolean
    backlight: boolean
    perKey: boolean
    onToggle: (patch: Partial<Omit<RgbControlsToggles, 'onToggle'>>) => void
}

interface Props {
    model: RgbControlsModel
    onEffect: (index: number) => void
    onChange: (
        patch: Partial<
            Pick<
                RgbControlsModel,
                'brightness' | 'saturation' | 'speed' | 'hue'
            >
        >,
    ) => void
    onReset: () => void
    /** Optional presentation toggles (demo mode). Omit for device mode. */
    toggles?: RgbControlsToggles
    note?: string
}

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

export function RgbControls({
    model,
    onEffect,
    onChange,
    onReset,
    toggles,
    note,
}: Props): JSX.Element {
    const { effects, effectIndex, hasColor, hasSpeed } = model
    const showColor = hasColor

    return (
        <div className="flex flex-col gap-4 text-sm">
            {note && <p className="text-xs text-muted-foreground">{note}</p>}

            {/* Effect */}
            <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Effect
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {effects.map((e, i) => {
                        const on = effectIndex === i
                        const Icon = iconFor(e)
                        return (
                            <button
                                key={`${e}-${i}`}
                                type="button"
                                onClick={() => onEffect(i)}
                                data-active={on}
                                className="flex flex-col items-center gap-1.5 rounded-xl border bg-background px-2 py-3 text-center text-[11px] font-medium capitalize text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground data-[active=true]:border-primary data-[active=true]:bg-primary/10 data-[active=true]:text-foreground"
                            >
                                <Icon className="size-4" />
                                <span className="leading-tight">{e}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Colour */}
            {showColor && (
                <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Colour
                    </p>
                    <div className="flex items-center gap-1.5">
                        {HUE_SWATCHES.map((h) => {
                            const on = model.hue === h
                            return (
                                <button
                                    key={h}
                                    type="button"
                                    aria-label={`Hue ${h}`}
                                    onClick={() => onChange({ hue: h })}
                                    className="size-[26px] rounded-md p-0"
                                    style={{
                                        border: `2px solid ${on ? 'var(--foreground)' : 'transparent'}`,
                                        background: `oklch(0.7 0.2 ${h})`,
                                    }}
                                />
                            )
                        })}
                    </div>
                    <div className="mt-2">
                        <Slider
                            label="Hue"
                            value={model.hue}
                            onChange={(v) => onChange({ hue: v })}
                            suffix="°"
                            max={360}
                        />
                    </div>
                </div>
            )}

            {/* Sliders */}
            <div className="flex flex-col gap-3">
                <Slider
                    label="Brightness"
                    value={model.brightness}
                    onChange={(v) => onChange({ brightness: v })}
                />
                {showColor && (
                    <Slider
                        label="Saturation"
                        value={model.saturation}
                        onChange={(v) => onChange({ saturation: v })}
                    />
                )}
                {hasSpeed && (
                    <Slider
                        label="Speed"
                        value={model.speed}
                        onChange={(v) => onChange({ speed: v })}
                    />
                )}
            </div>

            {/* Toggles (demo only) */}
            {toggles && (
                <div className="flex flex-col gap-1.5">
                    <ToggleRow
                        on={toggles.underglow}
                        onToggle={(v) => toggles.onToggle({ underglow: v })}
                        label="RGB underglow"
                    />
                    <ToggleRow
                        on={toggles.backlight}
                        onToggle={(v) => toggles.onToggle({ backlight: v })}
                        label="Per-key backlight"
                    />
                    <ToggleRow
                        on={toggles.perKey}
                        onToggle={(v) => toggles.onToggle({ perKey: v })}
                        label="Per-key colour"
                    />
                </div>
            )}

            <button
                type="button"
                onClick={onReset}
                className="mr-auto text-xs text-muted-foreground hover:text-foreground"
            >
                Reset to defaults
            </button>
        </div>
    )
}
