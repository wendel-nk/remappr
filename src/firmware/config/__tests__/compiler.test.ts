import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getCompiler, hasCompiler, parseKeymap } from '../index'

const seed = readFileSync(
    fileURLToPath(new URL('../../mock/seed.keymap.json', import.meta.url)),
    'utf8',
)
const config = parseKeymap(seed)

describe('keymap compilers', () => {
    it('registers all three targets', () => {
        expect(hasCompiler('zmk')).toBe(true)
        expect(hasCompiler('qmk')).toBe(true)
        expect(hasCompiler('keychron')).toBe(true)
    })

    it('compiles a ZMK .keymap with the expected behaviors', () => {
        const { files, diagnostics } = getCompiler('zmk').compile(config)
        // keymap + physical-layout overlay
        expect(files).toHaveLength(2)
        const keymap = files.find((f) => f.filename.endsWith('.keymap'))!
        const dts = String(keymap.content)
        expect(dts).toContain('compatible = "zmk,keymap"')
        expect(dts).toContain('&kp Q')
        expect(dts).toContain('&kp LC(C)') // "Ctrl+C" combo string
        expect(dts).toContain('&lt 1') // layer_tap -> lower (index 1)
        expect(dts).toContain('&mt LSHFT') // mod_tap -> Left Shift
        expect(dts).toContain('&mo 2') // momentary adjust (index 2)
        expect(dts).toContain('&bt BT_SEL 0')
        expect(dts).toContain('&rgb_ug RGB_TOG')
        expect(dts).toContain('combo_esc')
        expect(dts).toContain('zmk,behavior-macro')
        expect(dts).toContain('zmk,behavior-tap-dance')
        expect(dts).toContain('&inc_dec_kp') // encoder
        // per_key lighting is unsupported on ZMK -> warn
        expect(
            diagnostics.some(
                (d) => d.level === 'warn' && /per_key/.test(d.message),
            ),
        ).toBe(true)
    })

    it('compiles a QMK keymap.c with the expected keycodes', () => {
        const { files, diagnostics } = getCompiler('qmk').compile(config)
        const c = String(files[0].content)
        expect(files[0].filename).toBe('keymap.c')
        expect(c).toContain('const uint16_t PROGMEM keymaps')
        expect(c).toContain('MO(2)')
        expect(c).toContain('LT(1,')
        expect(c).toContain('LSFT_T(')
        expect(c).toContain('LCTL(') // Ctrl+C
        expect(c).toContain('RGB_MOD') // per_key effect_next is fine on QMK
        // bluetooth output has no standard QMK keycode -> warn
        expect(
            diagnostics.some(
                (d) =>
                    d.level === 'warn' && /output "bluetooth"/.test(d.message),
            ),
        ).toBe(true)
    })

    it('Keychron allows bluetooth output (no output warning)', () => {
        const { diagnostics } = getCompiler('keychron').compile(config)
        expect(
            diagnostics.some((d) => /output "bluetooth"/.test(d.message)),
        ).toBe(false)
    })

    it('emits a ZMK physical-layout .overlay from the geometry', () => {
        const { files } = getCompiler('zmk').compile(config)
        const overlay = files.find((f) => f.filename.endsWith('.overlay'))!
        const o = String(overlay.content)
        expect(o).toContain('#include <physical_layouts.dtsi>')
        expect(o).toContain('compatible = "zmk,physical-layout"')
        expect(o).toContain('&key_physical_attrs')
        // 36 keys -> 36 key_physical_attrs entries
        expect(o.match(/&key_physical_attrs/g)).toHaveLength(36)
    })
})

// A config exercising every behavior added for real-ZMK-config parity.
const EXTRA = `{
    "schemaVersion": 1,
    "kind": "remappr.keymap",
    "meta": { "name": "Extra", "target": null },
    "keyboard": { "id": "extra", "name": "Extra", "keys": [
        {"x":0,"y":0},{"x":1,"y":0},{"x":2,"y":0},{"x":3,"y":0},
        {"x":0,"y":1},{"x":1,"y":1},{"x":2,"y":1},{"x":3,"y":1},
        {"x":0,"y":2},{"x":1,"y":2},{"x":2,"y":2},{"x":3,"y":2},
        {"x":0,"y":3},{"x":1,"y":3},{"x":2,"y":3},{"x":3,"y":3}
    ] },
    "layers": [{ "name": "base", "bindings": [
        { "type": "key_toggle", "key": "CAPSLOCK" },
        { "type": "key_repeat" },
        { "type": "grave_escape" },
        { "type": "ext_power", "action": "toggle" },
        { "type": "mouse_key", "button": "left" },
        { "type": "mouse_move", "direction": "right" },
        { "type": "mouse_scroll", "direction": "down" },
        { "type": "studio_unlock" },
        { "type": "soft_off" },
        { "type": "output", "action": "bluetooth_next" },
        { "type": "output", "action": "bluetooth_prev" },
        { "type": "output", "action": "toggle" },
        { "type": "macro", "ref": "m_param", "param": "C" },
        { "type": "transparent" },
        { "type": "transparent" },
        { "type": "transparent" }
    ] }],
    "macros": [{
        "id": "m_param", "params": 1,
        "steps": [
            { "type": "press", "key": "LCTRL" },
            { "type": "param" },
            { "type": "pause_for_release" },
            { "type": "release", "key": "LCTRL" }
        ]
    }]
}`

describe('ZMK parity behaviors', () => {
    const dts = String(
        getCompiler('zmk').compile(parseKeymap(EXTRA)).files[0].content,
    )

    it('emits every new behavior token', () => {
        expect(dts).toContain('&kt CAPS')
        expect(dts).toContain('&key_repeat')
        expect(dts).toContain('&gresc')
        expect(dts).toContain('&ext_power EP_TOG')
        expect(dts).toContain('&mkp MB1')
        expect(dts).toContain('&mmv MOVE_RIGHT')
        expect(dts).toContain('&msc SCRL_DOWN')
        expect(dts).toContain('&studio_unlock')
        expect(dts).toContain('&soft_off')
        expect(dts).toContain('&bt BT_NXT')
        expect(dts).toContain('&bt BT_PRV')
        expect(dts).toContain('&out OUT_TOG')
        expect(dts).toContain('#include <dt-bindings/zmk/pointing.h>')
    })

    it('emits a one-param macro and its parametrized call', () => {
        expect(dts).toContain('compatible = "zmk,behavior-macro-one-param"')
        expect(dts).toContain('#binding-cells = <1>')
        expect(dts).toContain('&macro_param_1to1')
        expect(dts).toContain('&macro_pause_for_release')
        expect(dts).toContain('&m_param C')
    })

    it('QMK maps mouse keys and degrades ZMK-only behaviors', () => {
        const c = String(
            getCompiler('qmk').compile(parseKeymap(EXTRA)).files[0].content,
        )
        expect(c).toContain('KC_MS_BTN1')
        expect(c).toContain('KC_MS_RIGHT')
        expect(c).toContain('QK_GESC')
        expect(c).toContain('QK_REP')
    })
})
