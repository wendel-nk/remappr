// Pattern check: no GoF pattern (-) — rejected — canonical post-normalize data interfaces; plain discriminated unions, no abstraction.
//
// The CANONICAL config form. `normalizeKeymap` expands every surface shorthand
// (bare-string keys, mod_tap/layer_tap presets, "Ctrl+C" combo strings) into
// these explicit nodes, so lower/raise/compile never branch on surface sugar.
// Fields prefixed `_` are serialize hints (original spelling / preset) — never
// read by the compiler, only by denormalize on re-save.

import type { CanonicalKeyId } from '../catalog/types'
import type { Modifier } from './keycodes'

export type Target = 'zmk' | 'qmk' | 'keychron'

export type Resolve = 'timeout' | 'prefer-hold' | 'prefer-tap'

/** ZMK hold-tap `flavor` (the devicetree string values). */
export type HoldTapFlavor =
    | 'hold-preferred'
    | 'balanced'
    | 'tap-preferred'
    | 'tap-unless-interrupted'

export type LightingTarget = 'underglow' | 'backlight' | 'per_key'

export type LightingAction =
    | 'toggle'
    | 'on'
    | 'off'
    | 'brightness_up'
    | 'brightness_down'
    | 'hue_up'
    | 'hue_down'
    | 'saturation_up'
    | 'saturation_down'
    | 'effect_next'
    | 'effect_previous'
    | 'speed_up'
    | 'speed_down'
    | 'cycle'
    // Value-carrying: 'color' sets an absolute HSB (underglow → RGB_COLOR_HSB);
    // 'set' sets an absolute brightness level (backlight → BL_SET).
    | 'color'
    | 'set'

export type OutputAction =
    | 'usb'
    | 'bluetooth'
    | 'bluetooth_clear'
    | 'bluetooth_next'
    | 'bluetooth_prev'
    | 'bluetooth_disconnect'
    | 'toggle'
    | 'none'

export type LayerMode = 'momentary' | 'toggle' | 'to' | 'sticky'

export type PowerAction = 'toggle' | 'on' | 'off'

export type MouseButton = 'left' | 'right' | 'middle' | 'mb4' | 'mb5'

export type Direction = 'up' | 'down' | 'left' | 'right'

export interface CanonKeyPress {
    type: 'key_press'
    key: CanonicalKeyId
    mods?: Modifier[]
    /** Original key token, kept so serialize can preserve a canonical id / alias the user typed. */
    _keySrc?: string
}

export type CanonHoldTarget =
    | { type: 'modifier'; modifier: Modifier }
    | { type: 'layer'; layer: string }

export interface CanonTapHold {
    type: 'tap_hold'
    tap: CanonKeyPress
    hold: CanonHoldTarget
    tappingTermMs?: number
    quickTapMs?: number
    resolve?: Resolve
    /** Interrupt flavor. When this or a timing is set, ZMK gets a dedicated
     *  generated hold-tap node instead of the global &mt/&lt. */
    flavor?: HoldTapFlavor
    /** How the user wrote it, so serialize can re-emit the preset form. */
    _preset?: 'mod_tap' | 'layer_tap'
}

export type CanonAction =
    | CanonKeyPress
    | CanonTapHold
    | { type: 'layer'; mode: LayerMode; layer: string }
    | { type: 'sticky_key'; key: CanonicalKeyId; _keySrc?: string }
    | { type: 'caps_word' }
    | { type: 'transparent' }
    | { type: 'none' }
    | { type: 'output'; action: OutputAction; profile?: number }
    | {
          type: 'lighting'
          target: LightingTarget
          action: LightingAction
          /** action 'color': absolute HSB (hue 0–360, saturation/brightness 0–100). */
          hue?: number
          saturation?: number
          brightness?: number
          /** action 'set': absolute brightness level 0–100. */
          level?: number
      }
    | { type: 'bootloader' }
    | { type: 'reset' }
    | { type: 'soft_off' }
    | { type: 'studio_unlock' }
    | { type: 'grave_escape' }
    | { type: 'key_repeat' }
    | { type: 'key_toggle'; key: CanonicalKeyId; _keySrc?: string }
    | { type: 'ext_power'; action: PowerAction }
    | { type: 'mouse_key'; button: MouseButton }
    | { type: 'mouse_move'; direction: Direction }
    | { type: 'mouse_scroll'; direction: Direction }
    | { type: 'macro'; ref: string; param?: CanonicalKeyId; _paramSrc?: string }
    | { type: 'tap_dance'; ref: string }
    | { type: 'mod_morph'; ref: string }
    | { type: 'hold_tap'; ref: string; holdParam: string; tapParam: string }

export interface CanonGeometry {
    x: number
    y: number
    w: number
    h: number
    r: number
    rx?: number
    ry?: number
}

export interface CanonEncoderSlot {
    x: number
    y: number
}

export interface CanonEncoderBinding {
    cw: CanonAction
    ccw: CanonAction
    press?: CanonAction
}

export interface CanonLayer {
    name: string
    description?: string
    bindings: CanonAction[]
    encoders?: CanonEncoderBinding[]
}

export interface CanonCombo {
    name: string
    keys: number[]
    action: CanonAction
    timeoutMs?: number
    layers?: string[]
}

export interface CanonTapDanceStep {
    count: number
    action: CanonAction
}

export interface CanonTapDance {
    id: string
    description?: string
    tappingTermMs?: number
    taps: CanonTapDanceStep[]
    hold?: CanonHoldTarget
}

export type CanonMacroStep =
    | { type: 'tap'; key: CanonicalKeyId; _keySrc?: string }
    | { type: 'press'; key: CanonicalKeyId; _keySrc?: string }
    | { type: 'release'; key: CanonicalKeyId; _keySrc?: string }
    | { type: 'wait'; ms: number }
    | { type: 'text'; text: string }
    /** Forward a macro argument to the next behavior (&macro_param_<from>to<to>).
     *  Defaults to 1→1 (the one-param case). */
    | { type: 'param'; from?: 1 | 2; to?: 1 | 2 }
    /** Override how long tapped behaviors are held (&macro_tap_time). */
    | { type: 'tap_time'; ms: number }
    /** Block until the triggering key is released (&macro_pause_for_release). */
    | { type: 'pause_for_release' }

export interface CanonMacro {
    id: string
    description?: string
    /** Binding-cells: 0 = plain, 1 = one-param, 2 = two-param macro. */
    params?: 0 | 1 | 2
    steps: CanonMacroStep[]
}

/** A custom `zmk,behavior-hold-tap`. `bindings` are the two inner behavior
 *  tokens (e.g. "&kp", "&mo") invoked for hold and tap; a `hold_tap` action
 *  reference passes the hold/tap params. */
export interface CanonHoldTapDef {
    id: string
    description?: string
    flavor?: HoldTapFlavor
    tappingTermMs?: number
    quickTapMs?: number
    requirePriorIdleMs?: number
    holdTriggerKeyPositions?: number[]
    holdTriggerOnRelease?: boolean
    retroTap?: boolean
    bindings: [string, string]
}

/** A `zmk,behavior-mod-morph`: `bindings[0]` normally, `bindings[1]` while any
 *  `mods` modifier is held. `keepMods` passes those modifiers through. */
export interface CanonModMorph {
    id: string
    description?: string
    mods: Modifier[]
    keepMods?: Modifier[]
    bindings: [CanonAction, CanonAction]
}

export interface ConfigMeta {
    name: string
    author?: string
    version?: string
    description?: string
    target: Target | null
}

export interface ConfigDefaults {
    tappingTermMs?: number
    quickTapMs?: number
    comboTimeoutMs?: number
}

/** ZMK matrix `diode-direction`. */
export type DiodeDirection = 'row2col' | 'col2row'

/** A raw devicetree GPIO phandle+specifier, e.g.
 *  `"&gpio0 4 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)"`. Stored verbatim — remappr
 *  does not model SoC pin-mux; the builder UI composes these strings and the
 *  compiler emits them unchanged into the kscan node. */
export type GpioSpec = string

/** A `zmk,kscan-gpio-matrix` definition. */
export interface CanonMatrixKscan {
    type: 'matrix'
    diodeDirection: DiodeDirection
    rowGpios: GpioSpec[]
    colGpios: GpioSpec[]
    debouncePressMs?: number
    debounceReleaseMs?: number
}

/** A `zmk,kscan-gpio-direct` definition (one GPIO per key, no matrix). */
export interface CanonDirectKscan {
    type: 'direct'
    inputGpios: GpioSpec[]
    debouncePressMs?: number
    debounceReleaseMs?: number
}

export type CanonKscan = CanonMatrixKscan | CanonDirectKscan

/** The REAL electrical `zmk,matrix-transform`: one [row, col] per physical key,
 *  in physical-layout / keymap-binding order. When present it REPLACES the
 *  geometry-derived scaffold the compiler otherwise emits. */
export interface CanonMatrixTransform {
    rows: number
    columns: number
    /** [row, col] per key, in binding order. */
    map: [number, number][]
}

/** Board hardware definition (kscan wiring + electrical transform + target).
 *  Supplied by the Keyboard Builder; lets the ZMK compiler emit a flashable
 *  config instead of the geometry-derived scaffold + "NOT GENERATED" checklist.
 *  Everything is optional so a keymap-only config stays valid. */
export interface ConfigHardware {
    /** Zephyr board target (e.g. "nice_nano_v2", "seeeduino_xiao_ble"). */
    board?: string
    /** ZMK shield, when the keymap is a shield on a controller board. */
    shield?: string
    kscan?: CanonKscan
    transform?: CanonMatrixTransform
}

export interface ConfigKeyboard {
    id: string
    name: string
    keys: CanonGeometry[]
    encoders?: CanonEncoderSlot[]
    hardware?: ConfigHardware
}

/** Auto-activate `thenLayer` while every layer in `ifLayers` is active. */
export interface CanonConditionalLayer {
    ifLayers: string[]
    thenLayer: string
}

export interface ConfigKeymap {
    schemaVersion: 1
    kind: 'remappr.keymap'
    meta: ConfigMeta
    defaults?: ConfigDefaults
    keyboard: ConfigKeyboard
    layers: CanonLayer[]
    combos?: CanonCombo[]
    tapDances?: CanonTapDance[]
    macros?: CanonMacro[]
    modMorphs?: CanonModMorph[]
    holdTaps?: CanonHoldTapDef[]
    conditionalLayers?: CanonConditionalLayer[]
}
