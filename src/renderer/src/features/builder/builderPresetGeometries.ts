// Pattern check: no GoF pattern (-) — rejected — pure positional geometry
// builders returning plain CanonGeometry data + index-aligned legend tokens;
// no polymorphic hierarchy or shared state warrants a pattern here.
//
// Preset geometry builders (positions in key-units) extracted from
// builderPresets.ts. Each returns physical layout (`CanonGeometry[]`) and,
// where it carries a base-layer legend, an index-aligned `tokens` array as a
// `PresetBuild`. Assembled into `PRESETS` back in builderPresets.ts.

import { round3 } from '@/lib/clampInt'
import type { CanonGeometry } from '@firmware/config'
import type { PresetBuild } from './builderPresets'

export const key = (o: Partial<CanonGeometry>): CanonGeometry => ({
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    r: 0,
    ...o,
})

export function presetOrtho(cols: number, rows: number): CanonGeometry[] {
    const keys: CanonGeometry[] = []
    for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) keys.push(key({ x, y }))
    return keys
}

// Planck-style QWERTY for the 4×12 ortho (row-major, index-aligned).
export const ORTHO_TOKENS: string[] = [
    'TAB',
    'Q',
    'W',
    'E',
    'R',
    'T',
    'Y',
    'U',
    'I',
    'O',
    'P',
    'BSPC',
    'ESC',
    'A',
    'S',
    'D',
    'F',
    'G',
    'H',
    'J',
    'K',
    'L',
    'SEMI',
    'SQT',
    'LSHIFT',
    'Z',
    'X',
    'C',
    'V',
    'B',
    'N',
    'M',
    'COMMA',
    'DOT',
    'SLASH',
    'ENTER',
    'LCTL',
    'LGUI',
    'LALT',
    'BSPC',
    'SPACE',
    'SPACE',
    'ENTER',
    'LEFT',
    'DOWN',
    'UP',
    'RIGHT',
    'RCTL',
]

export function presetNumpad(): PresetBuild {
    const k: CanonGeometry[] = []
    const tokens: string[] = []
    const grid: Array<[string, string][]> = [
        [
            ['Num', 'KP_NUMLOCK'],
            ['/', 'KP_DIVIDE'],
            ['*', 'KP_MULTIPLY'],
            ['-', 'KP_MINUS'],
        ],
        [
            ['7', 'KP_N7'],
            ['8', 'KP_N8'],
            ['9', 'KP_N9'],
        ],
        [
            ['4', 'KP_N4'],
            ['5', 'KP_N5'],
            ['6', 'KP_N6'],
        ],
        [
            ['1', 'KP_N1'],
            ['2', 'KP_N2'],
            ['3', 'KP_N3'],
        ],
        [
            ['0', 'KP_N0'],
            ['.', 'KP_DOT'],
        ],
    ]
    grid.forEach((rw, y) =>
        rw.forEach(([lg, tok], x) => {
            k.push(key({ x, y, w: lg === '0' ? 2 : 1 }))
            tokens.push(tok)
        }),
    )
    k.push(key({ x: 3, y: 1, h: 2 })) // +
    tokens.push('KP_PLUS')
    k.push(key({ x: 3, y: 3, h: 2 })) // Enter
    tokens.push('KP_ENTER')
    return { keys: k, tokens }
}

export function preset60(): PresetBuild {
    const k: CanonGeometry[] = []
    // Row geometry (width per key) paired with its legend, index-aligned.
    const rows: Array<{ y: number; items: Array<[number, string]> }> = [
        {
            y: 0,
            items: [
                [1, 'GRAVE'],
                [1, 'N1'],
                [1, 'N2'],
                [1, 'N3'],
                [1, 'N4'],
                [1, 'N5'],
                [1, 'N6'],
                [1, 'N7'],
                [1, 'N8'],
                [1, 'N9'],
                [1, 'N0'],
                [1, 'MINUS'],
                [1, 'EQUAL'],
                [2, 'BSPC'],
            ],
        },
        {
            y: 1,
            items: [
                [1.5, 'TAB'],
                [1, 'Q'],
                [1, 'W'],
                [1, 'E'],
                [1, 'R'],
                [1, 'T'],
                [1, 'Y'],
                [1, 'U'],
                [1, 'I'],
                [1, 'O'],
                [1, 'P'],
                [1, 'LBKT'],
                [1, 'RBKT'],
                [1.5, 'BSLH'],
            ],
        },
        {
            y: 2,
            items: [
                [1.75, 'CAPS'],
                [1, 'A'],
                [1, 'S'],
                [1, 'D'],
                [1, 'F'],
                [1, 'G'],
                [1, 'H'],
                [1, 'J'],
                [1, 'K'],
                [1, 'L'],
                [1, 'SEMI'],
                [1, 'SQT'],
                [2.25, 'ENTER'],
            ],
        },
        {
            y: 3,
            items: [
                [2.25, 'LSHIFT'],
                [1, 'Z'],
                [1, 'X'],
                [1, 'C'],
                [1, 'V'],
                [1, 'B'],
                [1, 'N'],
                [1, 'M'],
                [1, 'COMMA'],
                [1, 'DOT'],
                [1, 'SLASH'],
                [2.75, 'RSHIFT'],
            ],
        },
        {
            y: 4,
            items: [
                [1.25, 'LCTL'],
                [1.25, 'LGUI'],
                [1.25, 'LALT'],
                [6.25, 'SPACE'],
                [1.25, 'RALT'],
                [1.25, 'RGUI'],
                [1.25, 'RCTL'],
                [1.25, 'DEL'],
            ],
        },
    ]
    const tokens: string[] = []
    rows.forEach(({ y, items }) => {
        let x = 0
        items.forEach(([w, tok]) => {
            k.push(key({ x, y, w }))
            tokens.push(tok)
            x += w
        })
    })
    return { keys: k, tokens }
}

export function presetCorne(): PresetBuild {
    // 3×6 columns per half + 3 thumbs each, column-staggered split. Keys are
    // pushed left-then-right per (row, col); tokens follow the same interleave.
    const keys: CanonGeometry[] = []
    const tokens: string[] = []
    const stag = [0.66, 0.25, 0, 0.12, 0.32, 0.42]
    const SPLIT = 1.6
    const RIGHT = 6 + SPLIT
    // Per-row, per-column legends for each half (c = 0..5, left→right).
    const left: string[][] = [
        ['TAB', 'Q', 'W', 'E', 'R', 'T'],
        ['ESC', 'A', 'S', 'D', 'F', 'G'],
        ['LSHIFT', 'Z', 'X', 'C', 'V', 'B'],
    ]
    const right: string[][] = [
        ['Y', 'U', 'I', 'O', 'P', 'BSPC'],
        ['H', 'J', 'K', 'L', 'SEMI', 'SQT'],
        ['N', 'M', 'COMMA', 'DOT', 'SLASH', 'ENTER'],
    ]
    for (let r = 0; r < 3; r++)
        for (let c = 0; c < 6; c++) {
            keys.push(key({ x: c, y: round3(r + stag[c]) }))
            tokens.push(left[r][c])
            keys.push(key({ x: RIGHT + c, y: round3(r + stag[5 - c]) }))
            tokens.push(right[r][c])
        }
    const ty = 3 + 0.55
    const leftThumb = ['LGUI', 'LALT', 'SPACE']
    const rightThumb = ['ENTER', 'BSPC', 'RALT']
    for (let i = 0; i < 3; i++) {
        keys.push(
            key({
                x: 3 + i,
                y: round3(ty + (i === 0 ? 0.3 : i === 1 ? 0.12 : 0)),
                r: 6 - i * 6,
                rx: 3 + i + 0.5,
                ry: ty + 0.5,
            }),
        )
        tokens.push(leftThumb[i])
        keys.push(
            key({
                x: RIGHT + 1 + i,
                y: round3(ty + (i === 2 ? 0.3 : i === 1 ? 0.12 : 0)),
                r: -(i * 6),
                rx: RIGHT + 1 + i + 0.5,
                ry: ty + 0.5,
            }),
        )
        tokens.push(rightThumb[i])
    }
    return { keys, tokens }
}
