// Pattern check: Strategy (Tier 1) — extended — concrete ZMK KeymapCompiler registered into the Strategy registry in compiler.ts.
//
// Emits a ZMK .keymap devicetree overlay directly from the canonical config.
// Behavior coverage tracks https://zmk.dev/docs/keymaps/behaviors. Anything a
// ZMK board can't express (per_key lighting, macro `text` steps, tap-dance
// `hold`) emits a `warn` diagnostic and degrades to a safe binding rather than
// producing broken devicetree.

import type { ExportedFile } from '../../types'
import type { DiagnosticBag } from '../diagnostics'
import { runCompile, registerCompiler, type KeymapCompiler } from '../compiler'
import { ZMK_MOD, ZMK_MOD_FN, zmkKeyName } from '../names'
import { resolveKeycode } from '../keycodes'
import type {
    CanonAction,
    CanonBacklightPwm,
    CanonExtPowerCtrl,
    CanonHoldTapDef,
    CanonKeyPress,
    CanonKscan,
    CanonMacro,
    CanonModMorph,
    CanonTapDance,
    CanonWs2812,
    ConfigHardware,
    ConfigKeymap,
    DiodeDirection,
    LightingAction,
} from '../types'
import type { Modifier } from '../keycodes'
import { resolveZmkPin, gpioSpec, type PinRole } from '../pinmaps'
import { resolveController, zmkSplitShields } from '../controller'
import { deriveMatrix, matrixSplit } from '../matrix'

const RGB_UG: Partial<Record<LightingAction, string>> = {
    toggle: 'RGB_TOG',
    on: 'RGB_ON',
    off: 'RGB_OFF',
    brightness_up: 'RGB_BRI',
    brightness_down: 'RGB_BRD',
    hue_up: 'RGB_HUI',
    hue_down: 'RGB_HUD',
    saturation_up: 'RGB_SAI',
    saturation_down: 'RGB_SAD',
    effect_next: 'RGB_EFF',
    effect_previous: 'RGB_EFR',
    speed_up: 'RGB_SPI',
    speed_down: 'RGB_SPD',
}
const BL: Partial<Record<LightingAction, string>> = {
    toggle: 'BL_TOG',
    on: 'BL_ON',
    off: 'BL_OFF',
    brightness_up: 'BL_INC',
    brightness_down: 'BL_DEC',
    cycle: 'BL_CYCLE',
}

const EP: Record<'toggle' | 'on' | 'off', string> = {
    toggle: 'EP_TOG',
    on: 'EP_ON',
    off: 'EP_OFF',
}
const MOUSE_BTN: Record<string, string> = {
    left: 'MB1',
    right: 'MB2',
    middle: 'MB3',
    mb4: 'MB4',
    mb5: 'MB5',
}
const MOVE: Record<string, string> = {
    up: 'MOVE_UP',
    down: 'MOVE_DOWN',
    left: 'MOVE_LEFT',
    right: 'MOVE_RIGHT',
}
const SCRL: Record<string, string> = {
    up: 'SCRL_UP',
    down: 'SCRL_DOWN',
    left: 'SCRL_LEFT',
    right: 'SCRL_RIGHT',
}

const sanitize = (id: string): string => id.replace(/[^a-zA-Z0-9_]/g, '_')

// ZMK modifier bitmask flags (dt-bindings/zmk/modifiers.h) for mod-morph `mods`.
const MOD_FLAG: Record<Modifier, string> = {
    LEFT_CTRL: 'MOD_LCTL',
    LEFT_SHIFT: 'MOD_LSFT',
    LEFT_ALT: 'MOD_LALT',
    LEFT_GUI: 'MOD_LGUI',
    RIGHT_CTRL: 'MOD_RCTL',
    RIGHT_SHIFT: 'MOD_RSFT',
    RIGHT_ALT: 'MOD_RALT',
    RIGHT_GUI: 'MOD_RGUI',
}
const modFlags = (mods: Modifier[]): string =>
    `(${mods.map((m) => MOD_FLAG[m]).join('|')})`

// Pattern check: no GoF pattern (-) — rejected — pure devicetree-string emit
// helpers on the existing Strategy compiler; string building, no new abstraction.
// Board-hardware nodes remappr cannot derive — the ZMK connection never exposes
// them. Emitted as a checklist comment so the file is a clear skeleton. When the
// builder supplies a kscan, the kscan/chosen/matrix-transform lines are GENERATED
// (see emitKscan/emitChosen) and drop out of this list, leaving only the
// SoC/peripheral nodes that still must come from the board's own overlay.
// pattern-check: skip checklist string-emit, gated on hw fields, no abstraction
function notGeneratedBlock(
    hasKscan: boolean,
    hw: ConfigHardware | undefined,
): string[] {
    // Peripherals remappr now emits drop out of the checklist.
    const hasLighting = !!(hw?.backlightPwm || hw?.ws2812)
    const hasExtPower = !!hw?.extPowerCtrl
    const hasAnyPeripheral = hasLighting || hasExtPower
    const items = [
        ...(hasKscan
            ? []
            : [
                  ` *   • kscan          — matrix/direct GPIO scan + row/col gpios`,
                  ` *   • chosen         — zmk,kscan / zmk,physical-layout / zmk,matrix-transform`,
                  ` *   • &gpio / diode-direction, debounce timings`,
              ]),
        // pinctrl for the kscan GPIOs is still board-specific; pinctrl for the
        // generated PWM/SPI peripherals IS emitted, so only mention kscan pins.
        ` *   • pinctrl / pins — SoC pin mux for the kscan GPIOs`,
        ...(hasLighting
            ? []
            : [
                  ` *   • underglow / backlight / RGB LED drivers (e.g. &led_strip)`,
              ]),
        ` *   • encoders (EC11 sensors) + sensor-channel wiring`,
        ...(hasExtPower
            ? []
            : [` *   • power / battery / ext-power control nodes`]),
        ` *   • display, pointing device, or other peripheral nodes`,
    ]
    const tail = hasKscan
        ? []
        : [
              ` *`,
              ` * Also re-check the matrix-transform RC() map above against your real`,
              ` * kscan — it is derived from physical position, not electrical wiring.`,
          ]
    const note = hasAnyPeripheral
        ? [
              ` *`,
              ` * Verify the generated peripheral pins (PWM/SPI/ext-power) against your`,
              ` * board's real wiring — remappr fills them from the builder's pin fields.`,
          ]
        : []
    return [
        `/* ─────────────────────────────────────────────────────────────────────`,
        ` * NOT GENERATED by remappr — board-specific hardware, add from your`,
        ` * board/shield overlay (these are wiring, not keymap):`,
        ` *`,
        ...items,
        ...tail,
        ...note,
        ` * ───────────────────────────────────────────────────────────────────── */`,
    ]
}

// Format a devicetree GPIO-list property: `name = <spec> , <spec> ;` one per
// line, mirroring a hand-written kscan node. Each spec is the user's verbatim
// phandle+flags string (e.g. "&gpio0 4 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)").
function gpioListProp(name: string, specs: string[]): string[] {
    return [
        `        ${name}`,
        ...specs.map((s, i) => `            ${i === 0 ? '=' : ','} <${s}>`),
        `            ;`,
    ]
}

// Emit a `zmk,kscan-gpio-{matrix,direct}` node, labelled `kscan0` so `chosen`
// can point `zmk,kscan` at it.
function emitKscan(kscan: CanonKscan): string[] {
    const out = [`    kscan0: kscan {`]
    if (kscan.type === 'matrix') {
        out.push(`        compatible = "zmk,kscan-gpio-matrix";`)
        out.push(`        diode-direction = "${kscan.diodeDirection}";`)
        out.push(...gpioListProp('row-gpios', kscan.rowGpios))
        out.push(...gpioListProp('col-gpios', kscan.colGpios))
    } else {
        out.push(`        compatible = "zmk,kscan-gpio-direct";`)
        out.push(...gpioListProp('input-gpios', kscan.inputGpios))
    }
    if (kscan.debouncePressMs !== undefined)
        out.push(`        debounce-press-ms = <${kscan.debouncePressMs}>;`)
    if (kscan.debounceReleaseMs !== undefined)
        out.push(`        debounce-release-ms = <${kscan.debounceReleaseMs}>;`)
    out.push(`    };`)
    return out
}

// Emit a devicetree GPIO-list property, resolving each FRIENDLY pin label via the
// board pin map. Resolved labels become a real `<&phandle pin FLAGS>` spec;
// unresolved ones (unknown board/label, or a missing per-key pin) become a TODO
// comment line + a `warn`, so the build clearly flags what the user must fill.
function resolvedGpioListProp(
    name: string,
    labels: string[],
    board: string | undefined,
    role: PinRole,
    diag: DiagnosticBag,
): string[] {
    const lines = [`        ${name}`]
    let firstReal = true
    labels.forEach((label, i) => {
        const trimmed = label.trim()
        const core = trimmed ? resolveZmkPin(board, trimmed) : null
        if (core) {
            lines.push(
                `            ${firstReal ? '=' : ','} <${gpioSpec(core, role)}>`,
            )
            firstReal = false
        } else if (!trimmed) {
            diag.warn(
                `${name}: position ${i} has no pin assigned — add the GpioSpec manually`,
                ['keyboard', 'pins'],
            )
            lines.push(
                `            /* [${i}] no pin assigned — add ${firstReal ? '=' : ','} <&gpio0 N FLAGS> */`,
            )
        } else {
            diag.warn(
                `pin "${trimmed}" not resolvable for board ${board ?? '(unset)'} — fill the ${name} GpioSpec manually`,
                ['keyboard', 'pins'],
            )
            lines.push(
                `            /* "${trimmed}" — no GpioSpec for board ${board ?? '(unset)'}; add ${firstReal ? '=' : ','} <&gpio0 N FLAGS> */`,
            )
        }
    })
    lines.push(`            ;`)
    return lines
}

// Synthesize a `kscan0` node from the builder's FRIENDLY pin labels when no
// explicit `hardware.kscan` was supplied: `keyboard.pins` (row/col labels) →
// matrix, else per-key `pin` → direct. Returns null when there are no pins to
// work with (caller then emits the geometry-only scaffold). `pins` carries no
// diode direction, so a matrix assumes the ZMK-common `col2row`.
function emitSynthKscan(
    config: ConfigKeymap,
    diag: DiagnosticBag,
): string[] | null {
    const board = resolveController(config).board
    const pins = config.keyboard.pins
    if (pins && pins.rows.length && pins.cols.length) {
        const dir: DiodeDirection = 'col2row'
        const rowRole: PinRole = dir === 'col2row' ? 'input' : 'output'
        const colRole: PinRole = dir === 'col2row' ? 'output' : 'input'
        return [
            `    kscan0: kscan {`,
            `        compatible = "zmk,kscan-gpio-matrix";`,
            `        /* diode-direction assumed "${dir}" — remappr pin labels carry none; verify. */`,
            `        diode-direction = "${dir}";`,
            ...resolvedGpioListProp(
                'row-gpios',
                pins.rows,
                board,
                rowRole,
                diag,
            ),
            ...resolvedGpioListProp(
                'col-gpios',
                pins.cols,
                board,
                colRole,
                diag,
            ),
            `    };`,
        ]
    }
    const keyPins = config.keyboard.keys.map((k) => k.pin ?? '')
    if (keyPins.some((p) => p.trim())) {
        return [
            `    kscan0: kscan {`,
            `        compatible = "zmk,kscan-gpio-direct";`,
            ...resolvedGpioListProp(
                'input-gpios',
                keyPins,
                board,
                'direct',
                diag,
            ),
            `    };`,
        ]
    }
    return null
}

// pattern-check: skip pure devicetree string-emit helpers, no abstraction
// `chosen` node wiring the generated kscan + physical-layout + any generated
// peripheral nodes (backlight / underglow / ext-power / studio CDC). The transform
// is referenced by the physical-layout's own `transform` property, so it is not
// repeated here. Returns [] when there is nothing to choose.
function emitChosen(
    hasKscan: boolean,
    hw: ConfigHardware | undefined,
): string[] {
    const entries = [
        ...(hasKscan ? [`        zmk,kscan = <&kscan0>;`] : []),
        ...(hasKscan
            ? [`        zmk,physical-layout = <&physical_layout_default>;`]
            : []),
        ...(hw?.backlightPwm
            ? [`        zmk,backlight = <&backlight_pwm>;`]
            : []),
        ...(hw?.ws2812 ? [`        zmk,underglow = <&led_strip>;`] : []),
        ...(hw?.extPowerCtrl
            ? [`        zmk,ext-power = <&ext_power_ctrl>;`]
            : []),
        ...(hw?.studioAcm
            ? [`        zmk,studio-rpc-uart = <&studio_acm>;`]
            : []),
    ]
    return entries.length ? [`    chosen {`, ...entries, `    };`] : []
}

// ── full-parity peripheral overlay nodes ────────────────────────────────────
// pattern-check: skip SoC classifier + pinctrl string-emit helpers, no abstraction
// Parse an nRF pin label "P0.13" → {port:0, pin:13}; null if not that form.
function parseNrfPin(s: string): { port: number; pin: number } | null {
    const m = /^P(\d+)\.(\d+)$/i.exec(s.trim())
    return m ? { port: Number(m[1]), pin: Number(m[2]) } : null
}

// Which ZMK SoC family a controller board belongs to. Pin-mux (pinctrl) syntax is
// SoC-specific — only nRF gets full NRF_PSEL generation; others get a labelled
// FIXME scaffold the user completes with their board's pinctrl bindings.
type ZmkSoc = 'nrf' | 'rp2040' | 'unknown'
function boardSoc(board: string | undefined): ZmkSoc {
    const b = (board ?? '').toLowerCase()
    if (!b) return 'unknown'
    if (b.includes('nrf') || b.includes('nice_nano') || b.includes('xiao_ble'))
        return 'nrf'
    if (b.includes('rp2040') || b.includes('pico')) return 'rp2040'
    return 'unknown'
}

// A default+sleep pinctrl group pair for an nRF instance, both pointing at the
// same psel (sleep adds low-power-enable). Shared by the PWM + SPI emitters.
function nrfPinctrlPair(instance: string, psel: string): string[] {
    return [
        `    ${instance}_default: ${instance}_default {`,
        `        group1 {`,
        `            psels = <${psel}>;`,
        `        };`,
        `    };`,
        `    ${instance}_sleep: ${instance}_sleep {`,
        `        group1 {`,
        `            psels = <${psel}>;`,
        `            low-power-enable;`,
        `        };`,
        `    };`,
    ]
}

// A clearly-FIXME pinctrl scaffold for non-nRF SoCs: the default+sleep groups
// exist (so the &instance block's pinctrl-0/-1 refs resolve) but the pin-mux is
// a placeholder the user must replace with their board's binding. nRF uses
// `psels = <NRF_PSEL(...)>`; RP2040 uses `pinmux = <…>` from the rpi-pico header.
function fixmePinctrlPair(
    instance: string,
    soc: ZmkSoc,
    pin: string,
    fn: string,
): string[] {
    const hint =
        soc === 'rp2040'
            ? 'RP2040: pinmux = <…> from <zephyr/dt-bindings/pinctrl/rpi-pico-rp2040-pinctrl.h>'
            : 'set your SoC pin-mux (nRF: psels=<NRF_PSEL(…)>; RP2040: pinmux=<…>)'
    const group = (extra: string[]): string[] => [
        `        /* FIXME (${soc}): pin-mux for ${fn} pin "${pin}" — ${hint}. */`,
        `        group1 {`,
        `            psels = <0>;`,
        ...extra,
        `        };`,
    ]
    return [
        `    ${instance}_default: ${instance}_default {`,
        ...group([]),
        `    };`,
        `    ${instance}_sleep: ${instance}_sleep {`,
        ...group([`            low-power-enable;`]),
        `    };`,
    ]
}

// Resolve a single control/data pin label → a devicetree GPIO core "&gpioN M".
// Accepts "P0.13", a verbatim "&gpio0 13 ..." (passed through), else null.
function gpioCoreFromPin(s: string): string | null {
    const t = s.trim()
    if (!t) return null
    if (t.startsWith('&')) return t
    const p = parseNrfPin(t)
    return p ? `&gpio${p.port} ${p.pin}` : null
}

// Devicetree `color-mapping` value for a WS2812 wire order.
function colorMapping(order: NonNullable<CanonWs2812['colorOrder']>): string {
    const ID: Record<string, string> = {
        R: 'LED_COLOR_ID_RED',
        G: 'LED_COLOR_ID_GREEN',
        B: 'LED_COLOR_ID_BLUE',
        W: 'LED_COLOR_ID_WHITE',
    }
    return order
        .split('')
        .map((c) => ID[c])
        .join(' ')
}

// `zmk,ext-power-generic` control node (lives inside `/ {}`).
function emitExtPowerGeneric(
    ep: CanonExtPowerCtrl,
    diag: DiagnosticBag,
): string[] {
    const flags = ep.activeLow ? 'GPIO_ACTIVE_LOW' : 'GPIO_ACTIVE_HIGH'
    const core = gpioCoreFromPin(ep.controlGpio)
    if (!core)
        diag.warn(
            `ext-power control-gpios "${ep.controlGpio}" not parseable — set the GPIO manually`,
            ['keyboard', 'hardware', 'extPowerCtrl'],
        )
    const spec = core
        ? `${core} ${flags}`
        : `&gpio0 0 ${flags} /* FIXME: "${ep.controlGpio}" */`
    return [
        `    ext_power_ctrl: ext_power_ctrl {`,
        `        compatible = "zmk,ext-power-generic";`,
        `        control-gpios = <${spec}>;`,
        ...(ep.initDelayMs !== undefined
            ? [`        init-delay-ms = <${ep.initDelayMs}>;`]
            : []),
        `    };`,
    ]
}

// pattern-check: skip SoC-aware branch in existing PWM emitter, conditional string building no abstraction
// Backlight: the `pwm-leds` root node + the `&pwm<n>` override + a `&pinctrl`
// group pair. nRF "P<port>.<pin>" pins get a real NRF_PSEL; other SoCs get a
// labelled FIXME pinctrl scaffold (the block is always emitted so the structure
// is complete — the user fills the board-specific pin-mux).
function emitBacklightPwm(
    bl: CanonBacklightPwm,
    diag: DiagnosticBag,
    board: string | undefined,
): { root: string[]; pinctrl: string[]; block: string[] } {
    const period = bl.periodMs ?? 10
    const polarity = bl.inverted
        ? 'PWM_POLARITY_INVERTED'
        : 'PWM_POLARITY_NORMAL'
    const root = [
        `    backlight_pwm: backlight_pwm {`,
        `        compatible = "pwm-leds";`,
        `        bl_led_0: bl_led_0 {`,
        `            pwms = <&${bl.instance} ${bl.channel} PWM_MSEC(${period}) ${polarity}>;`,
        `        };`,
        `    };`,
    ]
    const block = [
        `&${bl.instance} {`,
        `    status = "okay";`,
        `    pinctrl-0 = <&${bl.instance}_default>;`,
        `    pinctrl-1 = <&${bl.instance}_sleep>;`,
        `    pinctrl-names = "default", "sleep";`,
        `};`,
    ]
    const soc = boardSoc(board)
    const p = parseNrfPin(bl.pin)
    if (soc === 'nrf' && p) {
        const psel = `NRF_PSEL(PWM_OUT${bl.channel}, ${p.port}, ${p.pin})`
        return { root, pinctrl: nrfPinctrlPair(bl.instance, psel), block }
    }
    diag.warn(
        `backlight pin "${bl.pin}" on a ${soc} board — pinctrl emitted as a FIXME scaffold; complete the &${bl.instance} pin-mux for your board`,
        ['keyboard', 'hardware', 'backlightPwm'],
    )
    return {
        root,
        pinctrl: fixmePinctrlPair(bl.instance, soc, bl.pin, 'PWM backlight'),
        block,
    }
}

// pattern-check: skip SoC-aware branch in existing SPI/underglow emitter, conditional string building no abstraction
// Underglow: the `&spi<n>` block with a `worldsemi,ws2812-spi` led_strip child +
// a `&pinctrl` MOSI group pair. The SPI controller `compatible` + pin-mux are
// SoC-specific: nRF emits `nordic,nrf-spim` + a real NRF_PSEL; other SoCs emit
// the matching `compatible` (best-effort) + a FIXME pinctrl scaffold to complete.
function emitWs2812(
    ws: CanonWs2812,
    diag: DiagnosticBag,
    board: string | undefined,
): { pinctrl: string[]; block: string[] } {
    const freq = ws.spiMaxFrequency ?? 4000000
    const mapping = colorMapping(ws.colorOrder ?? 'GRB')
    const soc = boardSoc(board)
    const spiCompatible =
        soc === 'rp2040' ? 'raspberrypi,pico-spi' : 'nordic,nrf-spim'
    const block = [
        `&${ws.spi} {`,
        ...(soc === 'nrf'
            ? []
            : [
                  `    /* FIXME (${soc}): verify the SPI controller compatible + that ws2812-over-SPI`,
                  `       suits this SoC (RP2040 underglow is often PIO-based, not SPI). */`,
              ]),
        `    compatible = "${spiCompatible}";`,
        `    status = "okay";`,
        `    pinctrl-0 = <&${ws.spi}_default>;`,
        `    pinctrl-1 = <&${ws.spi}_sleep>;`,
        `    pinctrl-names = "default", "sleep";`,
        ``,
        `    led_strip: ws2812@0 {`,
        `        compatible = "worldsemi,ws2812-spi";`,
        `        reg = <0>;`,
        `        spi-max-frequency = <${freq}>;`,
        `        chain-length = <${ws.chainLength}>;`,
        `        spi-one-frame = <0x70>;`,
        `        spi-zero-frame = <0x40>;`,
        `        color-mapping = <${mapping}>;`,
        `    };`,
        `};`,
    ]
    const p = parseNrfPin(ws.dataPin)
    if (soc === 'nrf' && p) {
        const psel = `NRF_PSEL(SPIM_MOSI, ${p.port}, ${p.pin})`
        return { pinctrl: nrfPinctrlPair(ws.spi, psel), block }
    }
    diag.warn(
        `WS2812 data pin "${ws.dataPin}" on a ${soc} board — pinctrl emitted as a FIXME scaffold; complete the &${ws.spi} pin-mux (and verify ws2812-over-SPI fits this SoC)`,
        ['keyboard', 'hardware', 'ws2812'],
    )
    return {
        pinctrl: fixmePinctrlPair(ws.spi, soc, ws.dataPin, 'WS2812 SPI MOSI'),
        block,
    }
}

// CDC-ACM endpoint for ZMK Studio's RPC-over-USB transport.
function emitStudioAcm(): string[] {
    return [
        `&zephyr_udc0 {`,
        `    studio_acm: studio_acm {`,
        `        compatible = "zephyr,cdc-acm-uart";`,
        `    };`,
        `};`,
    ]
}

interface Ctx {
    layerIndex: Map<string, number>
    diag: DiagnosticBag
    /** Hold-tap nodes generated for tap_holds carrying custom flavor/timing,
     *  deduped by signature → id. Emitted as a behaviors block at the end. */
    genHoldTaps: Map<string, { id: string; lines: string[] }>
}

// Our `resolve` enum predates `flavor`; map it to the ZMK flavor it approximates.
const RESOLVE_TO_FLAVOR: Record<string, string> = {
    'prefer-hold': 'hold-preferred',
    'prefer-tap': 'tap-preferred',
}

// Generate (or reuse) a custom hold-tap node for a tap_hold with flavor/timing,
// returning its label. &mt is `<&kp>,<&kp>`; &lt is `<&mo>,<&kp>`.
function generateHoldTap(
    a: Extract<CanonAction, { type: 'tap_hold' }>,
    ctx: Ctx,
): string {
    const isLayer = a.hold.type === 'layer'
    const flavor =
        a.flavor ?? (a.resolve ? RESOLVE_TO_FLAVOR[a.resolve] : undefined)
    const sig = JSON.stringify([
        isLayer ? 'lt' : 'mt',
        flavor ?? '',
        a.tappingTermMs ?? '',
        a.quickTapMs ?? '',
    ])
    const hit = ctx.genHoldTaps.get(sig)
    if (hit) return hit.id
    const id = `ht_${ctx.genHoldTaps.size}`
    const lines = [
        `        ${id}: ${id} {`,
        `            compatible = "zmk,behavior-hold-tap";`,
        `            #binding-cells = <2>;`,
        `            bindings = <${isLayer ? '&mo' : '&kp'}>, <&kp>;`,
    ]
    if (flavor) lines.push(`            flavor = "${flavor}";`)
    if (a.tappingTermMs !== undefined)
        lines.push(`            tapping-term-ms = <${a.tappingTermMs}>;`)
    if (a.quickTapMs !== undefined)
        lines.push(`            quick-tap-ms = <${a.quickTapMs}>;`)
    lines.push(`        };`)
    ctx.genHoldTaps.set(sig, { id, lines })
    return id
}

// A hold-tap param is a keycode token when it resolves, else emitted raw (e.g. a
// layer index for an &mo/&lt inner binding).
function holdTapParam(token: string): string {
    const id = resolveKeycode(token)
    return id ? zmkKeyName(id) : token
}

function kp(kpAction: CanonKeyPress): string {
    let token = zmkKeyName(kpAction.key)
    // Wrap modifiers innermost-last: LC(LS(A)).
    for (const m of kpAction.mods ?? []) token = `${ZMK_MOD_FN[m]}(${token})`
    return `&kp ${token}`
}

function emitBinding(
    a: CanonAction,
    ctx: Ctx,
    path: (string | number)[],
): string {
    const layerIdx = (name: string): number => {
        const i = ctx.layerIndex.get(name)
        if (i === undefined) {
            ctx.diag.error(`unknown layer "${name}"`, path)
            return 0
        }
        return i
    }
    switch (a.type) {
        case 'key_press':
            return kp(a)
        case 'tap_hold': {
            const holdTok =
                a.hold.type === 'modifier'
                    ? ZMK_MOD[a.hold.modifier]
                    : String(layerIdx(a.hold.layer))
            const tapTok = zmkKeyName(a.tap.key)
            // Custom flavor/timing → a dedicated generated hold-tap node;
            // otherwise the global &mt / &lt.
            const hasCustom =
                a.flavor !== undefined ||
                a.tappingTermMs !== undefined ||
                a.quickTapMs !== undefined ||
                a.resolve !== undefined
            if (hasCustom)
                return `&${generateHoldTap(a, ctx)} ${holdTok} ${tapTok}`
            return a.hold.type === 'modifier'
                ? `&mt ${holdTok} ${tapTok}`
                : `&lt ${holdTok} ${tapTok}`
        }
        case 'layer':
            return a.mode === 'momentary'
                ? `&mo ${layerIdx(a.layer)}`
                : a.mode === 'toggle'
                  ? `&tog ${layerIdx(a.layer)}`
                  : a.mode === 'to'
                    ? `&to ${layerIdx(a.layer)}`
                    : `&sl ${layerIdx(a.layer)}`
        case 'sticky_key':
            return `&sk ${zmkKeyName(a.key)}`
        case 'caps_word':
            return '&caps_word'
        case 'transparent':
            return '&trans'
        case 'none':
            return '&none'
        case 'bootloader':
            return '&bootloader'
        case 'reset':
            return '&sys_reset'
        case 'output':
            if (a.action === 'usb') return '&out OUT_USB'
            if (a.action === 'toggle') return '&out OUT_TOG'
            if (a.action === 'none') return '&out OUT_NONE'
            if (a.action === 'bluetooth_clear') return '&bt BT_CLR'
            if (a.action === 'bluetooth_next') return '&bt BT_NXT'
            if (a.action === 'bluetooth_prev') return '&bt BT_PRV'
            if (a.action === 'bluetooth_disconnect')
                return `&bt BT_DISC ${a.profile ?? 0}`
            return a.profile !== undefined
                ? `&bt BT_SEL ${a.profile}`
                : '&out OUT_BLE'
        case 'lighting': {
            if (a.target === 'per_key') {
                ctx.diag.warn(
                    'per_key lighting is not available on ZMK; emitted &none',
                    path,
                )
                return '&none'
            }
            if (a.target === 'backlight') {
                // BL_SET carries an absolute level; the rest are in the BL map.
                if (a.action === 'set') return `&bl BL_SET ${a.level ?? 0}`
                const t = BL[a.action]
                if (!t) {
                    ctx.diag.warn(
                        `backlight has no "${a.action}" action on ZMK; emitted &none`,
                        path,
                    )
                    return '&none'
                }
                return `&bl ${t}`
            }
            // underglow: RGB_COLOR_HSB carries an absolute hue/sat/brightness.
            if (a.action === 'color') {
                return `&rgb_ug RGB_COLOR_HSB(${a.hue ?? 0},${a.saturation ?? 0},${a.brightness ?? 0})`
            }
            if (a.action === 'set') {
                ctx.diag.warn(
                    'underglow has no absolute "set" on ZMK (BL_SET is backlight-only); emitted RGB_TOG',
                    path,
                )
                return '&rgb_ug RGB_TOG'
            }
            return `&rgb_ug ${RGB_UG[a.action] ?? 'RGB_TOG'}`
        }
        case 'macro':
            return a.param !== undefined
                ? `&${sanitize(a.ref)} ${zmkKeyName(a.param)}`
                : `&${sanitize(a.ref)}`
        case 'tap_dance':
            return `&${sanitize(a.ref)}`
        case 'mod_morph':
            return `&${sanitize(a.ref)}`
        case 'hold_tap':
            return `&${sanitize(a.ref)} ${holdTapParam(a.holdParam)} ${holdTapParam(a.tapParam)}`
        case 'soft_off':
            return '&soft_off'
        case 'studio_unlock':
            return '&studio_unlock'
        case 'grave_escape':
            return '&gresc'
        case 'key_repeat':
            return '&key_repeat'
        case 'key_toggle':
            return `&kt ${zmkKeyName(a.key)}`
        case 'ext_power':
            return `&ext_power ${EP[a.action]}`
        case 'mouse_key':
            return `&mkp ${MOUSE_BTN[a.button]}`
        case 'mouse_move':
            return `&mmv ${MOVE[a.direction]}`
        case 'mouse_scroll':
            return `&msc ${SCRL[a.direction]}`
    }
}

function emitMacros(macros: CanonMacro[], ctx: Ctx): string[] {
    const out: string[] = []
    out.push('    macros {')
    for (const m of macros) {
        const bindings: string[] = []
        for (const s of m.steps) {
            if (s.type === 'press')
                bindings.push(`<&macro_press &kp ${zmkKeyName(s.key)}>`)
            else if (s.type === 'release')
                bindings.push(`<&macro_release &kp ${zmkKeyName(s.key)}>`)
            else if (s.type === 'tap')
                bindings.push(`<&macro_tap &kp ${zmkKeyName(s.key)}>`)
            else if (s.type === 'wait')
                bindings.push(`<&macro_wait_time ${s.ms}>`)
            else if (s.type === 'tap_time')
                bindings.push(`<&macro_tap_time ${s.ms}>`)
            else if (s.type === 'param')
                bindings.push(
                    `<&macro_tap &macro_param_${s.from ?? 1}to${s.to ?? 1}>`,
                )
            else if (s.type === 'pause_for_release')
                bindings.push(`<&macro_pause_for_release>`)
            else
                ctx.diag.warn(
                    `macro "${m.id}" text steps are not generated for ZMK`,
                    ['macros'],
                )
        }
        // #binding-cells: explicit `params`, else inferred from param steps
        // (highest `from` used). 0 = plain, 1 = one-param, 2 = two-param.
        const inferredCells = m.steps.reduce(
            (n, s) => (s.type === 'param' ? Math.max(n, s.from ?? 1) : n),
            0,
        )
        const cells = m.params ?? inferredCells
        const suffix =
            cells === 2 ? '-two-param' : cells === 1 ? '-one-param' : ''
        // A stub (no emittable steps) gets an inert &none + a visible TODO, so
        // the node is valid devicetree instead of an empty `bindings = ;`.
        const isStub = bindings.length === 0
        out.push(`        ${sanitize(m.id)}: ${sanitize(m.id)} {`)
        out.push(`            compatible = "zmk,behavior-macro${suffix}";`)
        out.push(`            #binding-cells = <${cells}>;`)
        if (isStub) {
            out.push(
                `            /* TODO: stub — restore this macro's steps from your board source. */`,
            )
            bindings.push('<&none>')
        }
        out.push(`            bindings = ${bindings.join(', ')};`)
        out.push(`        };`)
    }
    out.push('    };')
    return out
}

// Encoders → ZMK `sensor-bindings`. A keypress/keypress pair uses the built-in
// `&inc_dec_kp`; any other behavior pair needs a generated
// `zmk,behavior-sensor-rotate` node (referenced as `&sr_<layer>_<enc>`). The
// encoder PRESS action is a normal matrix key in ZMK (not a sensor binding), so
// it cannot live here — warned once. Returns the behavior-node lines plus the
// per-layer `sensor-bindings` value to splice into each layer node.
function emitEncoderSensors(
    config: ConfigKeymap,
    ctx: Ctx,
): { behaviorLines: string[]; byLayer: Map<number, string> } {
    const behaviorLines: string[] = []
    const byLayer = new Map<number, string>()
    let warnedPress = false

    // pattern-check: skip local cw/ccw pair → sensor token closure, no abstraction
    // A cw/ccw pair → one sensor-binding token: the built-in &inc_dec_kp for a
    // keypress/keypress pair, else a generated zmk,behavior-sensor-rotate node.
    const pairToken = (
        cw: CanonAction,
        ccw: CanonAction,
        idBase: string,
        path: (string | number)[],
    ): string => {
        if (cw.type === 'key_press' && ccw.type === 'key_press') {
            return `&inc_dec_kp ${zmkKeyName(cw.key)} ${zmkKeyName(ccw.key)}`
        }
        const id = `sr_${idBase}`
        const cwTok = emitBinding(cw, ctx, [...path, 'cw'])
        const ccwTok = emitBinding(ccw, ctx, [...path, 'ccw'])
        behaviorLines.push(
            `        ${id}: ${id} {`,
            `            compatible = "zmk,behavior-sensor-rotate";`,
            `            #sensor-binding-cells = <0>;`,
            `            bindings = <${cwTok}>, <${ccwTok}>;`,
            `        };`,
        )
        return `&${id}`
    }
    const warnPress = (path: (string | number)[]): void => {
        if (warnedPress) return
        ctx.diag.warn(
            'encoder press is a regular matrix key in ZMK, not a sensor binding; place it in the layer bindings instead',
            path,
        )
        warnedPress = true
    }

    // Per-key encoder model: positions tagged element:'encoder', in index order.
    // The sensor index is this order, so every layer that binds ANY encoder must
    // emit a token for ALL of them (missing → transparent) to stay aligned.
    const trans: CanonAction = { type: 'transparent' }
    const encoderKeys = config.keyboard.keys
        .map((k, i) => (k.element === 'encoder' ? i : -1))
        .filter((i) => i >= 0)

    config.layers.forEach((layer, li) => {
        const tokens: string[] = []
        // Legacy slot-indexed encoders[] (aligned to keyboard.encoders[]).
        layer.encoders?.forEach((e, ei) => {
            if (e.press) warnPress(['layers', li, 'encoders', ei, 'press'])
            tokens.push(
                pairToken(e.cw, e.ccw, `${li}_${ei}`, [
                    'layers',
                    li,
                    'encoders',
                    ei,
                ]),
            )
        })
        // Per-key encoderBindings (builder element model).
        if (
            encoderKeys.length &&
            Object.keys(layer.encoderBindings ?? {}).length
        ) {
            encoderKeys.forEach((ki) => {
                const e = layer.encoderBindings?.[ki] ?? {
                    cw: trans,
                    ccw: trans,
                }
                if (e.press)
                    warnPress(['layers', li, 'encoderBindings', ki, 'press'])
                tokens.push(
                    pairToken(e.cw, e.ccw, `${li}_k${ki}`, [
                        'layers',
                        li,
                        'encoderBindings',
                        ki,
                    ]),
                )
            })
        }
        if (tokens.length) byLayer.set(li, tokens.join(' '))
    })

    return { behaviorLines, byLayer }
}

// Pattern check: no GoF pattern (-) — rejected — pure devicetree-comment emitter
// on the existing Strategy compiler; analog input is board-specific, no abstraction.
// Sliders → analog (ADC) input. ZMK has no first-class keymap behavior for an
// analog axis, so this emits a NOT-GENERATED guidance block (the io-channels /
// zephyr,user wiring lives in the board overlay) plus the per-layer value-map
// remappr DID capture, so the firmware author has the intent in one place.
// Returns [] when no position carries element:'slider'.
function emitSliderInputs(config: ConfigKeymap, ctx: Ctx): string[] {
    const sliderKeys = config.keyboard.keys
        .map((k, i) => (k.element === 'slider' ? i : -1))
        .filter((i) => i >= 0)
    if (!sliderKeys.length) return []

    const mapNote: Record<string, string> = {
        volume: 'HID consumer volume (e.g. &kp C_VOL_UP/DOWN via a custom driver)',
        brightness: 'display/backlight brightness',
        mouse_wheel: 'mouse wheel (MOVE_Y / scroll report)',
        custom: 'custom behavior (see binding below)',
    }
    const out: string[] = [
        `    /* ─────────────────────────────────────────────────────────────────`,
        `     * SLIDER / ANALOG INPUT — NOT GENERATED by remappr`,
        `     * ZMK has no built-in keymap behavior for an analog axis. Add to your`,
        `     * board overlay: an &adc node, io-channels = <&adc N>, and a driver`,
        `     * (zephyr,user / custom behavior) that reads the channel and emits the`,
        `     * mapped output. remappr captured the value-map below so the intent is`,
        `     * in one place; wire the hardware side yourself.`,
        `     *`,
    ]
    sliderKeys.forEach((ki) => {
        const pin = config.keyboard.keys[ki]?.pin
        out.push(
            `     *   slider @ key ${ki}${pin ? ` (ADC pin ${pin})` : ''}:`,
        )
        config.layers.forEach((layer, li) => {
            const s = layer.sliderBindings?.[ki]
            if (!s) return
            const range =
                s.min !== undefined || s.max !== undefined
                    ? ` [${s.min ?? '…'}..${s.max ?? '…'}]`
                    : ''
            const custom =
                s.map === 'custom' && s.action
                    ? ` → ${emitBinding(s.action, ctx, ['layers', li, 'sliderBindings', ki, 'action'])}`
                    : ''
            out.push(
                `     *     ${layer.name}: ${s.map}${range} — ${mapNote[s.map]}${custom}`,
            )
        })
    })
    out.push(
        `     * ──────────────────────────────────────────────────────────────── */`,
        ``,
    )
    ctx.diag.warn(
        'sliders are analog (ADC) input — ZMK has no built-in behavior for them; a guidance block is emitted but the board-side io-channels/driver must be added by hand',
        ['keyboard', 'keys'],
    )
    return out
}

function emitHoldTapDefs(defs: CanonHoldTapDef[]): string[] {
    const out: string[] = ['    behaviors {']
    for (const h of defs) {
        const id = sanitize(h.id)
        out.push(
            `        ${id}: ${id} {`,
            `            compatible = "zmk,behavior-hold-tap";`,
            `            #binding-cells = <2>;`,
            `            bindings = <${h.bindings[0]}>, <${h.bindings[1]}>;`,
        )
        if (h.flavor) out.push(`            flavor = "${h.flavor}";`)
        if (h.tappingTermMs !== undefined)
            out.push(`            tapping-term-ms = <${h.tappingTermMs}>;`)
        if (h.quickTapMs !== undefined)
            out.push(`            quick-tap-ms = <${h.quickTapMs}>;`)
        if (h.requirePriorIdleMs !== undefined)
            out.push(
                `            require-prior-idle-ms = <${h.requirePriorIdleMs}>;`,
            )
        if (h.holdTriggerKeyPositions?.length)
            out.push(
                `            hold-trigger-key-positions = <${h.holdTriggerKeyPositions.join(' ')}>;`,
            )
        if (h.holdTriggerOnRelease)
            out.push(`            hold-trigger-on-release;`)
        if (h.retroTap) out.push(`            retro-tap;`)
        out.push(`        };`)
    }
    out.push('    };')
    return out
}

function emitModMorphs(morphs: CanonModMorph[], ctx: Ctx): string[] {
    const out: string[] = ['    behaviors {']
    for (const mm of morphs) {
        const id = sanitize(mm.id)
        const b0 = emitBinding(mm.bindings[0], ctx, ['modMorphs', mm.id, 0])
        const b1 = emitBinding(mm.bindings[1], ctx, ['modMorphs', mm.id, 1])
        out.push(
            `        ${id}: ${id} {`,
            `            compatible = "zmk,behavior-mod-morph";`,
            `            #binding-cells = <0>;`,
            `            bindings = <${b0}>, <${b1}>;`,
            `            mods = <${modFlags(mm.mods)}>;`,
        )
        if (mm.keepMods?.length)
            out.push(`            keep-mods = <${modFlags(mm.keepMods)}>;`)
        out.push(`        };`)
    }
    out.push('    };')
    return out
}

function emitTapDances(tds: CanonTapDance[], ctx: Ctx): string[] {
    const out: string[] = []
    out.push('    behaviors {')
    for (const td of tds) {
        if (td.hold) {
            ctx.diag.warn(
                `tap-dance "${td.id}" hold action is not representable in a ZMK tap-dance; dropped`,
                ['tapDances'],
            )
        }
        const bindings = [...td.taps]
            .sort((a, b) => a.count - b.count)
            .map((t) => `<${emitBinding(t.action, ctx, ['tapDances'])}>`)
        out.push(`        ${sanitize(td.id)}: ${sanitize(td.id)} {`)
        out.push(`            compatible = "zmk,behavior-tap-dance";`)
        out.push(`            #binding-cells = <0>;`)
        if (td.tappingTermMs !== undefined)
            out.push(`            tapping-term-ms = <${td.tappingTermMs}>;`)
        out.push(`            bindings = ${bindings.join(', ')};`)
        out.push(`        };`)
    }
    out.push('    };')
    return out
}

// Dense-rank distinct values to contiguous indices (0,1,2,…). Raw position can
// skip values (a vertical gap, a split half), which would leave holes in the
// matrix; ranking collapses each distinct row/column line to one matrix index.
function denseRank(values: number[]): Map<number, number> {
    const sorted = [...new Set(values)].sort((a, b) => a - b)
    return new Map(sorted.map((v, i) => [v, i]))
}

// Pattern check: no GoF pattern (-) — rejected — a branch added to an existing
// emit helper choosing real-vs-derived transform; conditional string building.
// Emit a `zmk,matrix-transform`. With a builder-supplied electrical transform
// (`keyboard.hardware.transform`) the real kscan wiring is used verbatim. Without
// one, the map is DERIVED from physical geometry: dense-rank distinct y → row and
// distinct x → col so the matrix is contiguous (no gaps). The derived map is a
// scaffold, not the true electrical matrix (ZMK does not expose kscan wiring over
// the connection) — so it is warned. Either way the map order matches the keymap
// binding order (physical-layout key order), which is what ZMK requires.
function emitMatrixTransform(
    config: ConfigKeymap,
    diag: DiagnosticBag,
): { lines: string[]; label: string } {
    const real = config.keyboard.hardware?.transform
    let cells: { row: number; col: number }[]
    let rows: number
    let columns: number
    let note: string

    if (real) {
        cells = real.map.map(([row, col]) => ({ row, col }))
        rows = real.rows
        columns = real.columns
        note = '/* From the board electrical wiring (builder). */'
    } else {
        const rowRank = denseRank(
            config.keyboard.keys.map((k) => Math.round(k.y)),
        )
        const colRank = denseRank(
            config.keyboard.keys.map((k) => Math.round(k.x)),
        )
        cells = config.keyboard.keys.map((k) => ({
            row: rowRank.get(Math.round(k.y)) ?? 0,
            col: colRank.get(Math.round(k.x)) ?? 0,
        }))
        rows = rowRank.size
        columns = colRank.size
        note = '/* DERIVED from key geometry — confirm against your kscan. */'
        diag.warn(
            'matrix-transform RC() values are derived from physical key position, ' +
                'not the board kscan wiring (ZMK does not expose it over the ' +
                'connection). Verify/replace them against your board before flashing.',
            ['keyboard', 'keys'],
        )
    }

    // One line per matrix row: break whenever the row index changes (keymap
    // order is row-major for the common case), mirroring a hand-written map.
    const lines: string[] = []
    let current = -1
    let line: string[] = []
    const flush = (): void => {
        if (line.length) lines.push('            ' + line.join(' '))
        line = []
    }
    for (const c of cells) {
        if (c.row !== current) {
            flush()
            current = c.row
        }
        line.push(`RC(${c.row},${c.col})`)
    }
    flush()

    return {
        label: 'default_transform',
        lines: [
            `    default_transform: keymap_transform_0 {`,
            `        compatible = "zmk,matrix-transform";`,
            `        ${note}`,
            `        columns = <${columns}>;`,
            `        rows = <${rows}>;`,
            `        map = <`,
            ...lines,
            `        >;`,
            `    };`,
        ],
    }
}

// Pattern check: no GoF pattern (-) — rejected — assembles the overlay file from
// the existing emit helpers; conditional concatenation, no new abstraction.
// Emit the `zmk,physical-layout` node from the config geometry + a
// `zmk,matrix-transform`. When the builder supplies `keyboard.hardware`, the real
// kscan + chosen nodes and the electrical transform are emitted too, making the
// overlay flashable; the NOT-GENERATED checklist then shrinks to the SoC /
// peripheral nodes that still must come from the board's own overlay.
function emitOverlay(config: ConfigKeymap, diag: DiagnosticBag): ExportedFile {
    const hw = config.keyboard.hardware
    const cu = (n: number): number => Math.round(n * 100) // key units -> centi-units
    const keyLines = config.keyboard.keys.map((k, i) => {
        const attrs =
            `<&key_physical_attrs ${cu(k.w)} ${cu(k.h)} ${cu(k.x)} ${cu(k.y)} ` +
            `${cu(k.r)} ${cu(k.rx ?? 0)} ${cu(k.ry ?? 0)}>`
        return `            ${i === 0 ? '=' : ','} ${attrs}`
    })

    const transform = emitMatrixTransform(config, diag)
    // Real kscan wins; else synthesize one from friendly pin labels.
    const explicitKscan = hw?.kscan ? emitKscan(hw.kscan) : null
    const synthKscan = explicitKscan ? null : emitSynthKscan(config, diag)
    const kscanLines = explicitKscan ?? synthKscan
    const hasKscan = kscanLines != null

    const ctrl = resolveController(config)
    const target = [
        ...(ctrl.board ? [` * Target board: ${ctrl.board}.`] : []),
        ...(ctrl.shield ? [` * Shield: ${ctrl.shield}.`] : []),
    ]
    const header = synthKscan
        ? [
              `/* Generated by remappr — ZMK overlay for ${config.keyboard.name}.`,
              ...target,
              ` * Physical layout, matrix-transform, chosen and a kscan SYNTHESIZED`,
              ` * from the builder's friendly pin labels are generated. Verify the`,
              ` * pin assignments + diode-direction, and add SoC/peripheral nodes`,
              ` * (pinctrl, LED drivers, …) from your board overlay. */`,
          ]
        : hasKscan
          ? [
                `/* Generated by remappr — ZMK overlay for ${config.keyboard.name}.`,
                ...target,
                ` * Physical layout, electrical matrix-transform, kscan, chosen and`,
                ` * any peripherals configured here (backlight/underglow/ext-power) are`,
                ` * generated. Remaining board-specific nodes (SoC pinctrl for the kscan,`,
                ` * anything not set in the builder) are listed in the checklist below. */`,
            ]
          : [
                `/* Generated by remappr — ZMK physical layout for ${config.keyboard.name}.`,
                ...target,
                ` * Key geometry + a geometry-DERIVED matrix-transform are generated.`,
                ` * Remaining hardware nodes (kscan, pinctrl, backlight/underglow`,
                ` * drivers) are board-specific — keep them in your board/shield overlay.`,
                ` * The matrix-transform RC() map is a scaffold from physical position,`,
                ` * NOT the real kscan wiring — verify it before flashing. */`,
            ]

    // pattern-check: skip assembling string arrays in existing emitter, no abstraction
    // Full-parity peripheral nodes (gated on the builder's hardware fields).
    const extPowerNode = hw?.extPowerCtrl
        ? emitExtPowerGeneric(hw.extPowerCtrl, diag)
        : []
    const bl = hw?.backlightPwm
        ? emitBacklightPwm(hw.backlightPwm, diag, ctrl.board)
        : null
    const ws = hw?.ws2812 ? emitWs2812(hw.ws2812, diag, ctrl.board) : null
    const studio = hw?.studioAcm ? emitStudioAcm() : []

    const rootPeripherals = [
        ...(extPowerNode.length ? [``, ...extPowerNode] : []),
        ...(bl ? [``, ...bl.root] : []),
    ]
    const pinctrlGroups = [...(bl?.pinctrl ?? []), ...(ws?.pinctrl ?? [])]
    const pinctrlBlock = pinctrlGroups.length
        ? [``, `&pinctrl {`, ...pinctrlGroups, `};`]
        : []
    const peripheralBlocks = [
        ...(bl && bl.block.length ? [``, ...bl.block] : []),
        ...(ws ? [``, ...ws.block] : []),
        ...(studio.length ? [``, ...studio] : []),
    ]
    const chosen = emitChosen(hasKscan, hw)

    const lines = [
        ...header,
        `#include <physical_layouts.dtsi>`,
        `#include <dt-bindings/zmk/matrix_transform.h>`,
        ...(hasKscan || hw?.extPowerCtrl
            ? [`#include <dt-bindings/gpio/gpio.h>`]
            : []),
        ...(hw?.ws2812 ? [`#include <zephyr/dt-bindings/led/led.h>`] : []),
        ``,
        `/ {`,
        ...(chosen.length ? [...chosen, ``] : []),
        `    physical_layout_default: physical_layout_default {`,
        `        compatible = "zmk,physical-layout";`,
        `        display-name = "${config.keyboard.name}";`,
        `        transform = <&${transform.label}>;`,
        `        keys`,
        ...keyLines,
        `            ;`,
        `    };`,
        ``,
        ...transform.lines,
        ...(kscanLines ? [``, ...kscanLines] : []),
        ...rootPeripherals,
        `};`,
        ...pinctrlBlock,
        ...peripheralBlocks,
        ``,
        ...notGeneratedBlock(hasKscan, hw),
        ``,
    ]
    return {
        filename: `${sanitize(config.keyboard.id || config.keyboard.name)}.overlay`,
        mime: 'text/plain',
        content: lines.join('\n'),
    }
}

// pattern-check: skip split-overlay emitter composing existing emit helpers, no abstraction
// Emit a real ZMK SPLIT shield: a shared `<base>.dtsi` (physical-layout + unified
// matrix-transform + a rows-only kscan + chosen + peripherals) and two thin
// overlays `<base>_left.overlay` / `<base>_right.overlay` that #include it and set
// each half's own col-gpios — the right one offsetting the transform by the left's
// column count. Mirrors the upstream corne shield. Falls back to the unibody overlay
// when the geometry doesn't split into exactly two column groups.
function emitSplitOverlay(
    config: ConfigKeymap,
    diag: DiagnosticBag,
): ExportedFile[] {
    const split = zmkSplitShields(config)
    const groups = matrixSplit(config.keyboard.keys)
    if (!split || groups.length !== 2) return [emitOverlay(config, diag)]
    const [left, right] = groups
    const L = left.columns
    const hw = config.keyboard.hardware
    const board = resolveController(config).board

    // Unified transform from the SAME derivation as the split groups, so the
    // right half's col-offset (= left column count) lines up with the map.
    const dm = deriveMatrix(config.keyboard.keys)
    const mapLines: string[] = []
    let curRow = -1
    let row: string[] = []
    const flushRow = (): void => {
        if (row.length) mapLines.push('            ' + row.join(' '))
        row = []
    }
    for (const [r, c] of dm.map) {
        if (r !== curRow) {
            flushRow()
            curRow = r
        }
        row.push(`RC(${r},${c})`)
    }
    flushRow()
    diag.warn(
        'split matrix-transform RC() values are derived from physical key position, ' +
            'not the board kscan wiring — verify them against your halves before flashing.',
        ['keyboard', 'keys'],
    )
    const transformLabel = 'default_transform'

    const cu = (n: number): number => Math.round(n * 100)
    const keyLines = config.keyboard.keys.map((k, i) => {
        const attrs =
            `<&key_physical_attrs ${cu(k.w)} ${cu(k.h)} ${cu(k.x)} ${cu(k.y)} ` +
            `${cu(k.r)} ${cu(k.rx ?? 0)} ${cu(k.ry ?? 0)}>`
        return `            ${i === 0 ? '=' : ','} ${attrs}`
    })

    // Per-half col labels: slice the unified col pins; an under-filled right half
    // reuses the left's (identical-half boards share the same column pins). Pad to
    // each half's column count so the kscan node always has the right shape.
    const pad = (arr: string[], n: number): string[] =>
        arr.length >= n
            ? arr.slice(0, n)
            : [...arr, ...Array(n - arr.length).fill('')]
    const pins = config.keyboard.pins
    const allCols = pins?.cols ?? []
    const rowLabels = pad(pins?.rows ?? [], dm.rows)
    const leftCols = pad(allCols.slice(0, L), L)
    const rightSlice = allCols.slice(L, L + right.columns)
    const rightCols = pad(
        rightSlice.length ? rightSlice : allCols.slice(0, right.columns),
        right.columns,
    )

    // Shared rows-only kscan (col-gpios are set per half in the overlays).
    const kscanRows = [
        `    kscan0: kscan {`,
        `        compatible = "zmk,kscan-gpio-matrix";`,
        `        wakeup-source;`,
        `        /* diode-direction assumed "col2row" — verify against your wiring. */`,
        `        diode-direction = "col2row";`,
        ...resolvedGpioListProp('row-gpios', rowLabels, board, 'input', diag),
        `        /* col-gpios set per half in ${split.left}.overlay / ${split.right}.overlay */`,
        `    };`,
    ]

    // Peripherals live in the shared dtsi → present on both halves (correct for
    // underglow/backlight/ext-power; the studio CDC is only used by the half on USB).
    const extPowerNode = hw?.extPowerCtrl
        ? emitExtPowerGeneric(hw.extPowerCtrl, diag)
        : []
    const bl = hw?.backlightPwm
        ? emitBacklightPwm(hw.backlightPwm, diag, board)
        : null
    const ws = hw?.ws2812 ? emitWs2812(hw.ws2812, diag, board) : null
    const studio = hw?.studioAcm ? emitStudioAcm() : []
    const rootPeripherals = [
        ...(extPowerNode.length ? [``, ...extPowerNode] : []),
        ...(bl ? [``, ...bl.root] : []),
    ]
    const pinctrlGroups = [...(bl?.pinctrl ?? []), ...(ws?.pinctrl ?? [])]
    const pinctrlBlock = pinctrlGroups.length
        ? [``, `&pinctrl {`, ...pinctrlGroups, `};`]
        : []
    const peripheralBlocks = [
        ...(bl && bl.block.length ? [``, ...bl.block] : []),
        ...(ws ? [``, ...ws.block] : []),
        ...(studio.length ? [``, ...studio] : []),
    ]
    const chosen = emitChosen(true, hw)

    const dtsi = [
        `/* Generated by remappr — SHARED split base for ${config.keyboard.name}.`,
        ` * #included by ${split.left}.overlay and ${split.right}.overlay. Holds the`,
        ` * physical layout, unified matrix-transform, a rows-only kscan and chosen.`,
        ` * Each half sets its own col-gpios; the right half offsets the transform. */`,
        `#include <physical_layouts.dtsi>`,
        `#include <dt-bindings/zmk/matrix_transform.h>`,
        `#include <dt-bindings/gpio/gpio.h>`,
        ...(ws ? [`#include <zephyr/dt-bindings/led/led.h>`] : []),
        ``,
        `/ {`,
        ...(chosen.length ? [...chosen, ``] : []),
        `    physical_layout_default: physical_layout_default {`,
        `        compatible = "zmk,physical-layout";`,
        `        display-name = "${config.keyboard.name}";`,
        `        transform = <&${transformLabel}>;`,
        `        keys`,
        ...keyLines,
        `            ;`,
        `    };`,
        ``,
        `    ${transformLabel}: keymap_transform_0 {`,
        `        compatible = "zmk,matrix-transform";`,
        `        /* DERIVED from key geometry — confirm against your kscan. */`,
        `        columns = <${dm.columns}>;`,
        `        rows = <${dm.rows}>;`,
        `        map = <`,
        ...mapLines,
        `        >;`,
        `    };`,
        ``,
        ...kscanRows,
        ...rootPeripherals,
        `};`,
        ...pinctrlBlock,
        ...peripheralBlocks,
        ``,
        ...notGeneratedBlock(true, hw),
        ``,
    ]

    const leftOverlay = [
        `/* Generated by remappr — ${split.left} half. Sets this half's col-gpios. */`,
        `#include "${split.base}.dtsi"`,
        ``,
        `&kscan0 {`,
        ...resolvedGpioListProp('col-gpios', leftCols, board, 'output', diag),
        `};`,
        ``,
    ]
    const rightOverlay = [
        `/* Generated by remappr — ${split.right} half. col-offset shifts this half's`,
        ` * ${right.columns} columns into the right block of the ${dm.columns}-column transform. */`,
        `#include "${split.base}.dtsi"`,
        ``,
        `&${transformLabel} {`,
        `    col-offset = <${L}>;`,
        `};`,
        ``,
        `&kscan0 {`,
        ...resolvedGpioListProp('col-gpios', rightCols, board, 'output', diag),
        `};`,
        ``,
    ]

    return [
        {
            filename: `${split.base}.dtsi`,
            mime: 'text/plain',
            content: dtsi.join('\n'),
        },
        {
            filename: `${split.left}.overlay`,
            mime: 'text/plain',
            content: leftOverlay.join('\n'),
        },
        {
            filename: `${split.right}.overlay`,
            mime: 'text/plain',
            content: rightOverlay.join('\n'),
        },
    ]
}

function emitKeymap(config: ConfigKeymap, diag: DiagnosticBag): ExportedFile[] {
    const ctx: Ctx = {
        layerIndex: new Map(config.layers.map((l, i) => [l.name, i])),
        diag,
        genHoldTaps: new Map(),
    }

    const lines: string[] = []
    lines.push(
        `/* Generated by remappr — ZMK keymap for ${config.keyboard.name}.`,
        ` * Keymap layers, behaviors, combos, macros and tap-dances only.`,
        ` * Physical layout + matrix-transform live in the .overlay; board`,
        ` * hardware (kscan, pinctrl, LED drivers, …) is NOT generated — see`,
        ` * the "NOT GENERATED" checklist in the .overlay. */`,
    )
    lines.push(`#include <behaviors.dtsi>`)
    lines.push(`#include <dt-bindings/zmk/keys.h>`)
    lines.push(`#include <dt-bindings/zmk/bt.h>`)
    lines.push(`#include <dt-bindings/zmk/outputs.h>`)
    lines.push(`#include <dt-bindings/zmk/rgb.h>`)
    lines.push(`#include <dt-bindings/zmk/backlight.h>`)
    lines.push(`#include <dt-bindings/zmk/ext_power.h>`)
    lines.push(`#include <dt-bindings/zmk/pointing.h>`)
    lines.push(``)
    lines.push(`/ {`)

    if (config.macros?.length) lines.push(...emitMacros(config.macros, ctx), ``)
    if (config.tapDances?.length)
        lines.push(...emitTapDances(config.tapDances, ctx), ``)
    if (config.modMorphs?.length)
        lines.push(...emitModMorphs(config.modMorphs, ctx), ``)
    if (config.holdTaps?.length)
        lines.push(...emitHoldTapDefs(config.holdTaps), ``)

    // Encoders: build sensor-rotate behavior nodes (non-keypress pairs) up front,
    // then reference them per layer below.
    const encoders = emitEncoderSensors(config, ctx)
    if (encoders.behaviorLines.length) {
        lines.push(`    behaviors {`, ...encoders.behaviorLines, `    };`, ``)
    }

    // Sliders: analog input has no ZMK keymap behavior — emit the captured
    // value-map as a guidance block (board-side wiring stays manual).
    lines.push(...emitSliderInputs(config, ctx))

    // combos
    if (config.combos?.length) {
        lines.push(`    combos {`)
        lines.push(`        compatible = "zmk,combos";`)
        config.combos.forEach((c, ci) => {
            const binding = emitBinding(c.action, ctx, ['combos', ci, 'action'])
            const layersAttr = c.layers?.length
                ? `\n            layers = <${c.layers.map((n) => ctx.layerIndex.get(n) ?? 0).join(' ')}>;`
                : ''
            lines.push(`        combo_${sanitize(c.name)} {`)
            if (c.timeoutMs !== undefined)
                lines.push(`            timeout-ms = <${c.timeoutMs}>;`)
            lines.push(`            key-positions = <${c.keys.join(' ')}>;`)
            lines.push(`            bindings = <${binding}>;${layersAttr}`)
            lines.push(`        };`)
        })
        lines.push(`    };`)
        lines.push(``)
    }

    // conditional layers
    if (config.conditionalLayers?.length) {
        const idx = (name: string): number => {
            const i = ctx.layerIndex.get(name)
            if (i === undefined) {
                diag.error(`unknown layer "${name}"`, ['conditionalLayers'])
                return 0
            }
            return i
        }
        lines.push(`    conditional_layers {`)
        lines.push(`        compatible = "zmk,conditional-layers";`)
        config.conditionalLayers.forEach((cl, ci) => {
            lines.push(`        cond_${ci} {`)
            lines.push(
                `            if-layers = <${cl.ifLayers.map(idx).join(' ')}>;`,
            )
            lines.push(`            then-layer = <${idx(cl.thenLayer)}>;`)
            lines.push(`        };`)
        })
        lines.push(`    };`)
        lines.push(``)
    }

    // keymap
    lines.push(`    keymap {`)
    lines.push(`        compatible = "zmk,keymap";`)
    config.layers.forEach((layer, li) => {
        const cells = layer.bindings.map((b, bi) =>
            emitBinding(b, ctx, ['layers', li, 'bindings', bi]),
        )
        const wrapped: string[] = []
        for (let i = 0; i < cells.length; i += 6) {
            wrapped.push('                ' + cells.slice(i, i + 6).join(' '))
        }
        lines.push(`        layer_${sanitize(layer.name)} {`)
        lines.push(`            display-name = "${layer.name}";`)
        lines.push(`            bindings = <`)
        lines.push(wrapped.join('\n'))
        lines.push(`            >;`)
        // encoders -> sensor-bindings (inc_dec_kp for keypress pairs, generated
        // sensor-rotate nodes for anything else — see emitEncoderSensors)
        const sensorBindings = encoders.byLayer.get(li)
        if (sensorBindings) {
            lines.push(`            sensor-bindings = <${sensorBindings}>;`)
        }
        lines.push(`        };`)
    })
    lines.push(`    };`)

    // Hold-tap nodes generated for custom-flavor/timing tap_holds above. Emitted
    // after the keymap (devicetree resolves the &ht_N labels regardless of order).
    if (ctx.genHoldTaps.size) {
        lines.push(``)
        lines.push(`    behaviors {`)
        for (const g of ctx.genHoldTaps.values()) lines.push(...g.lines)
        lines.push(`    };`)
    }

    lines.push(`};`)
    lines.push(``)

    const keymapFile: ExportedFile = {
        filename: `${sanitize(config.keyboard.id || config.keyboard.name)}.keymap`,
        mime: 'text/plain',
        content: lines.join('\n'),
    }
    return [
        keymapFile,
        ...(config.keyboard.split
            ? emitSplitOverlay(config, diag)
            : [emitOverlay(config, diag)]),
    ]
}

export const zmkCompiler: KeymapCompiler = {
    target: 'zmk',
    compile: (config) => runCompile(config, emitKeymap),
}

registerCompiler(zmkCompiler)
