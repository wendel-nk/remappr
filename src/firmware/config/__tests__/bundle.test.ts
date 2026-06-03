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

describe('buildProjectBundle — ZMK', () => {
    it('emits a complete zmk-config skeleton', () => {
        const b = buildProjectBundle(seedConfig, 'zmk')
        const shield = seedConfig.keyboard.id
        expect(paths(b)).toEqual(
            expect.arrayContaining([
                `config/${shield}.keymap`,
                `config/${shield}.conf`,
                `config/${shield}.overlay`,
                'config/west.yml',
                'build.yaml',
                '.github/workflows/build.yml',
                'README.md',
            ]),
        )
        expect(b.rootName).toBe(`${shield}-zmk-config`)
        // keymap content is the real compiled devicetree
        expect(fileText(b, `config/${shield}.keymap`)).toContain(
            'compatible = "zmk,keymap"',
        )
        // workflow uses the official reusable build
        expect(fileText(b, '.github/workflows/build.yml')).toContain(
            'zmkfirmware/zmk/.github/workflows/build-user-config.yml',
        )
    })

    it('uses board/shield from hardware and enables matching conf flags', () => {
        const b = buildProjectBundle(parseKeymap(HW), 'zmk')
        expect(b.rootName).toBe('boardx-zmk-config')
        expect(fileText(b, 'build.yaml')).toContain('board: nice_nano_v2')
        expect(fileText(b, 'build.yaml')).toContain('shield: boardx')
        const conf = fileText(b, 'config/boardx.conf')
        expect(conf).toContain('CONFIG_ZMK_STUDIO=y')
        expect(conf).toContain('CONFIG_ZMK_RGB_UNDERGLOW=y') // underglow used
        expect(conf).toContain('# CONFIG_ZMK_BACKLIGHT=y') // unused → commented
        // the generated overlay carries the real kscan
        expect(fileText(b, 'config/boardx.overlay')).toContain(
            'zmk,kscan-gpio-matrix',
        )
    })
})

describe('buildProjectBundle — QMK', () => {
    it('emits a qmk_userspace skeleton with build target', () => {
        const b = buildProjectBundle(seedConfig, 'qmk')
        const kb = seedConfig.keyboard.id
        expect(paths(b)).toEqual(
            expect.arrayContaining([
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
})
