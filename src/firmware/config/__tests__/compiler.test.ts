import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getCompiler, hasCompiler, parseKeymap } from '../index'

const seed = readFileSync(
    fileURLToPath(new URL('../../mock/seed.keymap.json5', import.meta.url)),
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
        expect(files).toHaveLength(1)
        const dts = String(files[0].content)
        expect(files[0].filename).toMatch(/\.keymap$/)
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
})
