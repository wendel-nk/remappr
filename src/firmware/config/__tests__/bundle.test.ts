import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildProjectBundle, parseKeymap } from '../index'

const seed = readFileSync(
    fileURLToPath(new URL('../../mock/seed.keymap.json', import.meta.url)),
    'utf8',
)
const seedConfig = parseKeymap(seed)

const paths = (b: { files: { filename: string }[] }): string[] =>
    b.files.map((f) => f.filename)
const fileText = (
    b: { files: { filename: string; content: string | Uint8Array }[] },
    name: string,
): string => String(b.files.find((f) => f.filename === name)!.content)

const HW = `{
    "schemaVersion": 1, "kind": "remappr.keymap",
    "meta": { "name": "Board X", "target": "zmk" },
    "keyboard": {
        "id": "board_x", "name": "Board X",
        "keys": [{"x":0,"y":0},{"x":1,"y":0}],
        "hardware": {
            "board": "nice_nano_v2",
            "shield": "boardx",
            "kscan": {
                "type": "matrix", "diodeDirection": "col2row",
                "rowGpios": ["&gpio0 5 X"],
                "colGpios": ["&gpio0 6 X", "&gpio0 7 X"]
            }
        }
    },
    "layers": [{ "name": "base", "bindings": [
        { "type": "lighting", "target": "underglow", "action": "toggle" },
        "B"
    ] }]
}`

const HW_FULL = `{
    "schemaVersion": 1, "kind": "remappr.keymap",
    "meta": { "name": "Board Y", "target": "zmk" },
    "keyboard": {
        "id": "board_y", "name": "Board Y",
        "keys": [{"x":0,"y":0},{"x":1,"y":0}],
        "controller": { "board": "nrf52840dk_nrf52840", "shield": "boardy" },
        "firmwareConfig": { "ble": true },
        "hardware": {
            "kscan": {
                "type": "matrix", "diodeDirection": "col2row",
                "rowGpios": ["&gpio0 5 X"], "colGpios": ["&gpio0 6 X"]
            },
            "backlightPwm": { "instance": "pwm0", "channel": 0, "pin": "P0.13", "inverted": true },
            "ws2812": { "spi": "spi3", "dataPin": "P1.13", "chainLength": 10, "colorOrder": "GRB" },
            "extPowerCtrl": { "controlGpio": "P0.14", "activeLow": true, "initDelayMs": 10 },
            "studioAcm": true
        }
    },
    "layers": [{ "name": "base", "bindings": ["A", "B"] }]
}`

describe('buildProjectBundle — ZMK', () => {
    it('emits a full zmk-config shield skeleton', () => {
        const b = buildProjectBundle(seedConfig, 'zmk')
        const id = seedConfig.keyboard.id
        const SH = id.toUpperCase()
        const dir = `config/boards/shields/${id}`
        expect(paths(b)).toEqual(
            expect.arrayContaining([
                `${dir}/${SH}.keymap`,
                `${dir}/${SH}.conf`,
                `${dir}/${SH}.overlay`,
                `${dir}/Kconfig.shield`,
                `${dir}/Kconfig.defconfig`,
                `${dir}/${id}.zmk.yml`,
                'config/west.yml',
                'build.yaml',
                '.github/workflows/build.yml',
                'README.md',
            ]),
        )
        expect(b.rootName).toBe(`${id}-zmk-config`)
        // keymap content is the real compiled devicetree
        expect(fileText(b, `${dir}/${SH}.keymap`)).toContain(
            'compatible = "zmk,keymap"',
        )
        // Kconfig registers the shield by its uppercase name
        expect(fileText(b, `${dir}/Kconfig.shield`)).toContain(
            `config SHIELD_${SH}`,
        )
        expect(fileText(b, `${dir}/Kconfig.defconfig`)).toContain(
            'ZMK_KEYBOARD_NAME',
        )
        // workflow uses the official reusable build
        expect(fileText(b, '.github/workflows/build.yml')).toContain(
            'zmkfirmware/zmk/.github/workflows/build-user-config.yml',
        )
    })

    it('uses board/shield from hardware and enables matching conf flags', () => {
        const b = buildProjectBundle(parseKeymap(HW), 'zmk')
        const dir = 'config/boards/shields/boardx'
        expect(b.rootName).toBe('boardx-zmk-config')
        expect(fileText(b, 'build.yaml')).toContain('board: nice_nano_v2')
        expect(fileText(b, 'build.yaml')).toContain('shield: BOARDX')
        const conf = fileText(b, `${dir}/BOARDX.conf`)
        expect(conf).toContain('CONFIG_ZMK_STUDIO=y')
        expect(conf).toContain('CONFIG_ZMK_USB=y') // USB on by default
        expect(conf).toContain('# CONFIG_ZMK_BLE=y') // BLE opt-in → commented
        expect(conf).toContain('CONFIG_ZMK_RGB_UNDERGLOW=y') // underglow used
        expect(conf).toContain('# CONFIG_ZMK_BACKLIGHT=y') // unused → commented
        expect(conf).toContain('# CONFIG_ZMK_USB_LOGGING=y') // off → commented hint
        // the generated overlay carries the real kscan
        expect(fileText(b, `${dir}/BOARDX.overlay`)).toContain(
            'zmk,kscan-gpio-matrix',
        )
    })

    it('emits full-parity peripheral overlay nodes + chosen + conf flags', () => {
        const b = buildProjectBundle(parseKeymap(HW_FULL), 'zmk')
        const dir = 'config/boards/shields/boardy'
        const overlay = fileText(b, `${dir}/BOARDY.overlay`)
        // chosen wires every generated peripheral
        expect(overlay).toContain('zmk,backlight = <&backlight_pwm>')
        expect(overlay).toContain('zmk,underglow = <&led_strip>')
        expect(overlay).toContain('zmk,ext-power = <&ext_power_ctrl>')
        expect(overlay).toContain('zmk,studio-rpc-uart = <&studio_acm>')
        // peripheral nodes
        expect(overlay).toContain('compatible = "zmk,ext-power-generic"')
        expect(overlay).toContain('control-gpios = <&gpio0 14 GPIO_ACTIVE_LOW>')
        expect(overlay).toContain('compatible = "pwm-leds"')
        expect(overlay).toContain('PWM_POLARITY_INVERTED')
        expect(overlay).toContain('compatible = "worldsemi,ws2812-spi"')
        expect(overlay).toContain('chain-length = <10>')
        expect(overlay).toContain(
            'color-mapping = <LED_COLOR_ID_GREEN LED_COLOR_ID_RED LED_COLOR_ID_BLUE>',
        )
        expect(overlay).toContain('compatible = "zephyr,cdc-acm-uart"')
        // pinctrl psels parsed from the nRF P<port>.<pin> labels
        expect(overlay).toContain('NRF_PSEL(PWM_OUT0, 0, 13)')
        expect(overlay).toContain('NRF_PSEL(SPIM_MOSI, 1, 13)')
        expect(overlay).toContain('&pinctrl {')
        expect(overlay).toContain('#include <zephyr/dt-bindings/led/led.h>')
        // conf flags follow the hardware + studio CDC
        const conf = fileText(b, `${dir}/BOARDY.conf`)
        expect(conf).toContain('CONFIG_ZMK_BACKLIGHT=y')
        expect(conf).toContain('CONFIG_PWM=y')
        expect(conf).toContain('CONFIG_ZMK_RGB_UNDERGLOW=y')
        expect(conf).toContain('CONFIG_ZMK_EXT_POWER=y')
        expect(conf).toContain('CONFIG_ZMK_BLE=y')
        expect(conf).toContain('CONFIG_ZMK_STUDIO_TRANSPORT_UART=y')
    })
})

const QMK_FULL = `{
    "schemaVersion": 1, "kind": "remappr.keymap",
    "meta": { "name": "Plank", "target": "qmk", "author": "me",
              "vendorId": "0x1234", "productId": "0x5678" },
    "keyboard": {
        "id": "plank", "name": "Plank",
        "keys": [{"x":0,"y":0},{"x":1,"y":0,"w":2}],
        "controller": {
            "processor": "atmega32u4", "bootloader": "atmel-dfu",
            "board": "PROMICRO", "deviceVersion": "1.0.0"
        },
        "pins": { "rows": ["B0"], "cols": ["B1", "B2"] }
    },
    "layers": [{ "name": "base", "bindings": ["A", "B"] }]
}`

describe('buildProjectBundle — QMK', () => {
    it('emits a qmk_userspace skeleton with a keyboard.json + build target', () => {
        const b = buildProjectBundle(seedConfig, 'qmk')
        const kb = seedConfig.keyboard.id
        expect(paths(b)).toEqual(
            expect.arrayContaining([
                `keyboards/${kb}/keyboard.json`,
                `keyboards/${kb}/keymaps/remappr/keymap.c`,
                `keyboards/${kb}/keymaps/remappr/rules.mk`,
                `keyboards/${kb}/keymaps/remappr/config.h`,
                'qmk.json',
                '.github/workflows/build_binaries.yml',
                'README.md',
            ]),
        )
        expect(b.rootName).toBe(`${kb}-qmk-userspace`)
        expect(
            fileText(b, `keyboards/${kb}/keymaps/remappr/keymap.c`),
        ).toContain('PROGMEM keymaps')
        const manifest = JSON.parse(fileText(b, 'qmk.json'))
        expect(manifest.build_targets).toEqual([[kb, 'remappr']])
    })

    it('keyboard.json carries identity, matrix pins and a LAYOUT', () => {
        const b = buildProjectBundle(parseKeymap(QMK_FULL), 'qmk')
        const json = JSON.parse(fileText(b, 'keyboards/plank/keyboard.json'))
        expect(json.keyboard_name).toBe('Plank')
        expect(json.maintainer).toBe('me')
        expect(json.usb).toEqual({
            vid: '0x1234',
            pid: '0x5678',
            device_version: '1.0.0',
        })
        expect(json.processor).toBe('atmega32u4')
        expect(json.bootloader).toBe('atmel-dfu')
        expect(json.board).toBe('PROMICRO')
        expect(json.matrix_pins).toEqual({ rows: ['B0'], cols: ['B1', 'B2'] })
        expect(json.diode_direction).toBe('COL2ROW')
        // LAYOUT pairs each key's [row,col] with its placement; w!=1 is kept.
        expect(json.layouts.LAYOUT.layout).toEqual([
            { matrix: [0, 0], x: 0, y: 0 },
            { matrix: [0, 1], x: 1, y: 0, w: 2 },
        ])
    })

    it('warns + defaults USB ids when the builder left them unset', () => {
        const b = buildProjectBundle(seedConfig, 'qmk')
        const kb = seedConfig.keyboard.id
        const json = JSON.parse(fileText(b, `keyboards/${kb}/keyboard.json`))
        expect(json.usb.vid).toBe('0xFEED')
        expect(
            b.diagnostics.some((d) => /vendor\/product id/.test(d.message)),
        ).toBe(true)
    })

    it('does not emit a VIA definition or enable VIA when not targeted', () => {
        const b = buildProjectBundle(parseKeymap(QMK_FULL), 'qmk')
        expect(paths(b)).not.toContain('via/plank.json')
        expect(
            fileText(b, 'keyboards/plank/keymaps/remappr/rules.mk'),
        ).not.toContain('VIA_ENABLE')
    })
})

const VIA_FULL = `{
    "schemaVersion": 1, "kind": "remappr.keymap",
    "meta": { "name": "Macro5", "target": "qmk",
              "vendorId": "0xCEEB", "productId": "0x0007" },
    "keyboard": {
        "id": "macro5", "name": "Macro5",
        "keys": [{"x":0,"y":0},{"x":1,"y":0},{"x":2,"y":0}],
        "pins": { "rows": ["B0"], "cols": ["B1", "B2", "B3"] },
        "firmware": ["qmk", "via"]
    },
    "layers": [
        { "name": "base", "bindings": [
            "A",
            { "type": "layer", "mode": "momentary", "layer": "fn" },
            "B"
        ] },
        { "name": "fn", "bindings": [] }
    ]
}`

describe('buildProjectBundle — VIA', () => {
    it('ships a VIA definition + enables VIA when via is targeted', () => {
        const b = buildProjectBundle(parseKeymap(VIA_FULL), 'qmk')
        expect(paths(b)).toContain('via/macro5.json')
        // VIA support compiled into the keymap
        expect(
            fileText(b, 'keyboards/macro5/keymaps/remappr/rules.mk'),
        ).toContain('VIA_ENABLE = yes')
        // definition carries identity + matrix
        const def = JSON.parse(fileText(b, 'via/macro5.json'))
        expect(def.name).toBe('Macro5')
        expect(def.vendorId).toBe('0xCEEB')
        expect(def.productId).toBe('0x0007')
        expect(def.matrix).toEqual({ rows: 1, cols: 3 })
    })

    it('the VIA keymap carries "row,col" legends + per-category cap colours', () => {
        const b = buildProjectBundle(parseKeymap(VIA_FULL), 'qmk')
        const def = JSON.parse(fileText(b, 'via/macro5.json'))
        // one physical row, three keys; matrix annotation is the top-left legend
        const row = def.layouts.keymap[0]
        expect(row).toEqual([
            '0,0', // A → neutral alpha cap (no colour prop)
            { c: '#6fa8dc' }, // layer key → blue
            '0,1',
            { c: '#cccccc' }, // back to neutral for B
            '0,2',
        ])
    })
})

const VIAL_FULL = `{
    "schemaVersion": 1, "kind": "remappr.keymap",
    "meta": { "name": "Pad", "target": "qmk",
              "vendorId": "0xCEEB", "productId": "0x0007" },
    "keyboard": {
        "id": "pad", "name": "Pad",
        "keys": [{"x":0,"y":0},{"x":1,"y":0}],
        "pins": { "rows": ["B0"], "cols": ["B1", "B2"] },
        "firmware": ["qmk", "via", "vial"],
        "vial": {
            "uid": [254, 6, 191, 82, 24, 186, 79, 138],
            "unlockKeys": [[0, 0], [0, 1]]
        }
    },
    "layers": [{ "name": "base", "bindings": ["A", "B"] }]
}`

describe('buildProjectBundle — Vial', () => {
    it('ships vial.json + a UID/unlock config.h and enables VIAL', () => {
        const b = buildProjectBundle(parseKeymap(VIAL_FULL), 'qmk')
        expect(paths(b)).toContain('keyboards/pad/keymaps/remappr/vial.json')
        const rules = fileText(b, 'keyboards/pad/keymaps/remappr/rules.mk')
        expect(rules).toContain('VIA_ENABLE = yes')
        expect(rules).toContain('VIAL_ENABLE = yes')
        const configH = fileText(b, 'keyboards/pad/keymaps/remappr/config.h')
        expect(configH).toContain(
            '#define VIAL_KEYBOARD_UID {0xFE, 0x06, 0xBF, 0x52, 0x18, 0xBA, 0x4F, 0x8A}',
        )
        expect(configH).toContain('#define VIAL_UNLOCK_COMBO_ROWS {0, 0}')
        expect(configH).toContain('#define VIAL_UNLOCK_COMBO_COLS {0, 1}')
    })

    it('does not ship vial artifacts when vial is not targeted', () => {
        const b = buildProjectBundle(parseKeymap(VIA_FULL), 'qmk')
        expect(paths(b)).not.toContain(
            'keyboards/macro5/keymaps/remappr/vial.json',
        )
        expect(
            fileText(b, 'keyboards/macro5/keymaps/remappr/rules.mk'),
        ).not.toContain('VIAL_ENABLE')
    })
})
