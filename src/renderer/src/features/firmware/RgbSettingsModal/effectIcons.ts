// pattern-check: skip — keyword→icon resolver, presentational helper, no abstraction
// Resolve an effect glyph by keyword — covers every subsystem's effect names
// (ported from the old BacklightPanel). Ordered: more specific patterns first.
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

export const ICON_RULES: [RegExp, LucideIcon][] = [
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

export const iconFor = (name: string): LucideIcon =>
    ICON_RULES.find(([re]) => re.test(name))?.[1] ?? Circle
