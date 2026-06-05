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
    /** Physical-layout variant id this key belongs to ("" / absent = common to
     *  all variants). Set by the builder; compilers ignore unknown variants. */
    variant?: string
    /** Per-key electrical matrix position `[row, col]` — the generalized field
     *  every firmware needs (QMK `matrix:[r,c]`, VIA/Vial KLE legend, ZMK
     *  `RC(r,c)`). Friendly + co-located authoring source; when present it is
     *  authoritative, else the compiler derives it from geometry (see
     *  `materializeMatrix`). Keyboard-specific — never default-stripped. */
    matrix?: [number, number]
    /** Optional per-key direct GPIO pin label (builder metadata, e.g. "GP29").
     *  Used for direct-pin kscan; kept separate from the matrix wiring so editing
     *  a label never corrupts the electrical transform. */
    pin?: string
    /** Input element this position represents: absent / "key" = a normal switch;
     *  "encoder" = a rotary encoder; "slider" = an analog slider. Builder
     *  metadata — compilers treat every entry as a key for now. */
    element?: 'encoder' | 'slider'
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

/** What an analog slider's position controls. `volume`/`brightness`/`mouse_wheel`
 *  are well-known mapped outputs; `custom` defers to `action`. */
export type SliderMap = 'volume' | 'brightness' | 'mouse_wheel' | 'custom'

/** A slider's value-mapping: the ADC sweep mapped onto an output. `min`/`max`
 *  bound the output range (firmware defaults when absent); `action` is the
 *  output behavior for `map: "custom"`. Analog input has no first-class keymap
 *  behavior in ZMK/QMK, so compilers emit this as guided scaffolding, not full
 *  codegen — see emitSliderInputs (ZMK) / emitSliderStub (QMK). */
export interface CanonSliderBinding {
    map: SliderMap
    min?: number
    max?: number
    action?: CanonAction
}

export interface CanonLayer {
    name: string
    description?: string
    bindings: CanonAction[]
    /** Slot-indexed encoder bindings — index-aligned to `keyboard.encoders[]`.
     *  The original ZMK-style parallel array, kept for boards that declare
     *  encoder slots separately from keys. */
    encoders?: CanonEncoderBinding[]
    /** Per-key encoder bindings, keyed by the position's index in
     *  `keyboard.keys` (the key must have `element: "encoder"`). The builder's
     *  element model writes here; lets a single physical position carry both a
     *  base binding and rotary cw/ccw/press without a parallel slot array. */
    encoderBindings?: Record<number, CanonEncoderBinding>
    /** Per-key slider value-mappings, keyed by the position's index in
     *  `keyboard.keys` (the key must have `element: "slider"`). Parallels
     *  `encoderBindings` — one analog input element per physical position. */
    sliderBindings?: Record<number, CanonSliderBinding>
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
    /** USB vendor id, hex string e.g. "0xFEED" (builder identity). */
    vendorId?: string
    /** USB product id, hex string e.g. "0x0001" (builder identity). */
    productId?: string
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
    /** @deprecated Use `keyboard.controller.board`. Read as a back-compat
     *  fallback by `resolveController`. Zephyr board target (e.g. "nice_nano_v2"). */
    board?: string
    /** @deprecated Use `keyboard.controller.shield`. Read as a back-compat
     *  fallback by `resolveController`. ZMK shield on a controller board. */
    shield?: string
    kscan?: CanonKscan
    transform?: CanonMatrixTransform
}

/** RGB underglow board-level config (builder metadata; export-only for now). */
export interface CanonUnderglow {
    /** Effect name (e.g. "solid", "breathe", "rainbow") — firmware-specific. */
    effect?: string
    /** Hue 0–360. */
    hue?: number
    /** Brightness 0–100. */
    brightness?: number
}

/** Per-key backlight board-level config (builder metadata; export-only for now). */
export interface CanonBacklight {
    /** Brightness 0–100. */
    brightness?: number
    breathing?: boolean
}

/** Board lighting metadata supplied by the builder. Compilers emit lighting
 *  *actions*; this board-level config is additive (export-only) for now. */
export interface CanonLighting {
    underglow?: CanonUnderglow
    backlight?: CanonBacklight
}

/** A named physical-layout variant (keys tag into it via `CanonGeometry.variant`). */
export interface CanonLayout {
    id: string
    name: string
}

/** Friendly per-row / per-column GPIO pin labels shown in the builder (e.g.
 *  "GP4"). Builder metadata, kept separate from `hardware.kscan` (the real
 *  devicetree GpioSpec wiring) so editing a label here never corrupts ZMK
 *  export; compilers map these to their firmware's pin syntax. `rows`/`cols`
 *  are index-aligned to the electrical transform's rows/columns. */
export interface ConfigPins {
    rows: string[]
    cols: string[]
}

/** Board-level matrix descriptor: dimensions + diode direction + scan mode.
 *  The friendly summary of the wiring (the per-key `[row,col]` lives on each
 *  key). `mode` picks matrix (row/col GPIOs) vs direct (one GPIO per key). */
export interface CanonKeyboardMatrix {
    rows: number
    cols: number
    diodeDirection?: DiodeDirection
    mode?: 'matrix' | 'direct'
}

/** Controller / MCU identity for a flashable build. ZMK uses `board` (a Zephyr
 *  board, e.g. "nice_nano_v2") + optional `shield`; QMK uses `processor` +
 *  `bootloader` (+ a `board` support file), or the `developmentBoard` shortcut
 *  (e.g. "promicro", "blackpill_f401") which sets all three, plus `deviceVersion`
 *  (USB bcdDevice, e.g. "1.0.0"). All optional so a keymap-only config stays
 *  valid. Supersedes `hardware.board` / `hardware.shield` (kept for back-compat). */
export interface CanonController {
    /** ZMK Zephyr board, or QMK `board` support-file name. */
    board?: string
    /** ZMK shield, when the keymap is a shield on a controller board. */
    shield?: string
    /** QMK MCU family, e.g. "atmega32u4", "STM32F103", "RP2040". */
    processor?: string
    /** QMK bootloader, e.g. "atmel-dfu", "rp2040", "uf2boot". */
    bootloader?: string
    /** QMK `development_board` shortcut (sets processor+bootloader+board),
     *  e.g. "promicro", "blackpill_f401". */
    developmentBoard?: string
    /** USB device version (bcdDevice), e.g. "0.0.1" / "1.0.0". */
    deviceVersion?: string
}

export interface ConfigKeyboard {
    id: string
    name: string
    keys: CanonGeometry[]
    encoders?: CanonEncoderSlot[]
    /** Board-level matrix descriptor (dims + diode + scan mode). */
    matrix?: CanonKeyboardMatrix
    /** Controller / MCU identity (board/shield/processor/bootloader/…). */
    controller?: CanonController
    hardware?: ConfigHardware
    /** Friendly row/column GPIO labels (builder metadata). */
    pins?: ConfigPins
    /** Raw multi-select firmware targets from the builder (qmk/via/vial/zmk).
     *  Looser than `meta.target`; via/vial compile through the QMK family. */
    firmware?: string[]
    /** Board-level lighting config (builder). */
    lighting?: CanonLighting
    /** Physical-layout variants (builder); keys tag in via `variant`. */
    layouts?: CanonLayout[]
    /** Two-piece / split keyboard (builder capability flag; export metadata). */
    split?: boolean
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
