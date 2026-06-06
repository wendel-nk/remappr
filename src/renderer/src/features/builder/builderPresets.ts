// Pattern check: no GoF pattern (-) — rejected — preset data + pure geometry
// builder functions + a positional KLE→geometry parser; plain data construction
// ported from app/builder/BuilderData.jsx, no polymorphic hierarchy warranted.
//
// Starting-point boards for the "Build from" menu. Each preset returns a
// `PresetBuild` = `{ keys: CanonGeometry[], tokens: string[] }`: the physical
// layout AND a base-layer legend (index-aligned to `keys`) so a preset lands as a
// usable keymap, not a board of pass-throughs. `tokens` are keycode strings the
// builder resolves to bindings via `actionFromToken`; an empty/unknown token
// becomes a transparent key. `guessCategory` is kept for cap colouring.

import type { KeyCategory } from '@/lib/keymap/keyCategory'
import type {
    CanonAction,
    CanonGeometry,
    ConfigKeymap,
    Target,
} from '@firmware/config'
import { resolveKeycode } from '@firmware/config'
import { normalizeBoard } from './builderMatrix'
import { newBoardConfig, replaceGeometry } from './geometryEditor'

const r3 = (v: number): number => Math.round(v * 1000) / 1000

/** A preset's output: physical geometry + an index-aligned base-layer legend. */
export interface PresetBuild {
    keys: CanonGeometry[]
    tokens: string[]
}

// pattern-check: skip pure token→CanonAction mapper, no abstraction
/** Resolve a preset legend token to a binding. Blank / unknown → transparent. */
export function actionFromToken(tok: string): CanonAction {
    const t = tok.trim()
    if (!t) return { type: 'transparent' }
    const key = resolveKeycode(t)
    return key ? { type: 'key_press', key } : { type: 'transparent' }
}

/** Options carried by a preset (or grid/KLE import) when it lands on the board. */
export interface ApplyPresetOpts {
    firmware?: string[]
    tokens?: string[]
    split?: boolean
    controller?: { board?: string; shield?: string }
}

// pattern-check: skip shared pure preset-apply transform, dedups modal + seed, no abstraction
/** Land a fresh geometry on `config`: swap the keys (resets bindings), seed the
 *  base-layer legend from `tokens`, and carry the preset's firmware/split/controller.
 *  Pure — the single source of truth used by both the "Build from" modal and the
 *  builder's first-open seed, so an unattended start is as complete as a picked preset. */
export function applyPresetGeometry(
    config: ConfigKeymap,
    keys: CanonGeometry[],
    opts: ApplyPresetOpts = {},
): ConfigKeymap {
    let next = replaceGeometry(config, keys)
    const keyboard = { ...next.keyboard }
    if (opts.firmware) keyboard.firmware = opts.firmware
    if (opts.split !== undefined) keyboard.split = opts.split
    if (opts.controller)
        keyboard.controller = { ...keyboard.controller, ...opts.controller }
    next = { ...next, keyboard }
    if (opts.tokens) {
        const tokens = opts.tokens
        next = {
            ...next,
            layers: next.layers.map((l, i) =>
                i === 0
                    ? {
                          ...l,
                          bindings: keys.map((_k, j) =>
                              actionFromToken(tokens[j] ?? ''),
                          ),
                      }
                    : l,
            ),
        }
    }
    return next
}

/** Best-effort legend → function category, for cap colouring (ported guessCat). */
export function guessCategory(legend: string): KeyCategory {
    const lg = legend.trim()
    if (!lg) return 'trans'
    if (/^[A-Za-z]$/.test(lg)) return 'alpha'
    if (/^(F\d+|Esc|PrSc|ScLk|Paus|Boot|Reset)$/.test(lg)) return 'system'
    if (/^[0-9]$/.test(lg)) return 'num'
    if (
        /^(Ctrl|Shift|Alt|Gui|Cmd|Win|Caps|LSft|RSft|LCtl|RCtl|LAlt|RAlt|LGui|RGui)$/i.test(
            lg,
        )
    )
        return 'mod'
    if (/^(MO|TG|TT|LT|OSL|TO|DF)/.test(lg)) return 'layer'
    if (/^(←|↓|↑|→|Home|End|PgUp|PgDn|Ins)$/.test(lg)) return 'nav'
    if (/^(Tab|Ent|Bsp|Del|Spc|Spce|␣)$/.test(lg)) return 'edit'
    if (/^(Vol|Mut|▶|⏮|⏭|Play)/.test(lg)) return 'media'
    if (/^(M[12←↓↑→]|Scr|Mouse)/.test(lg)) return 'mouse'
    return 'punct'
}

const key = (o: Partial<CanonGeometry>): CanonGeometry => ({
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    r: 0,
    ...o,
})

/* ── preset geometry builders (positions in key-units) ─────────────────── */

function presetOrtho(cols: number, rows: number): CanonGeometry[] {
    const keys: CanonGeometry[] = []
    for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) keys.push(key({ x, y }))
    return keys
}

// Planck-style QWERTY for the 4×12 ortho (row-major, index-aligned).
const ORTHO_TOKENS: string[] = [
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

function presetNumpad(): PresetBuild {
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

function preset60(): PresetBuild {
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

function presetCorne(): PresetBuild {
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
            keys.push(key({ x: c, y: r3(r + stag[c]) }))
            tokens.push(left[r][c])
            keys.push(key({ x: RIGHT + c, y: r3(r + stag[5 - c]) }))
            tokens.push(right[r][c])
        }
    const ty = 3 + 0.55
    const leftThumb = ['LGUI', 'LALT', 'SPACE']
    const rightThumb = ['ENTER', 'BSPC', 'RALT']
    for (let i = 0; i < 3; i++) {
        keys.push(
            key({
                x: 3 + i,
                y: r3(ty + (i === 0 ? 0.3 : i === 1 ? 0.12 : 0)),
                r: 6 - i * 6,
                rx: 3 + i + 0.5,
                ry: ty + 0.5,
            }),
        )
        tokens.push(leftThumb[i])
        keys.push(
            key({
                x: RIGHT + 1 + i,
                y: r3(ty + (i === 2 ? 0.3 : i === 1 ? 0.12 : 0)),
                r: -(i * 6),
                rx: RIGHT + 1 + i + 0.5,
                ry: ty + 0.5,
            }),
        )
        tokens.push(rightThumb[i])
    }
    return { keys, tokens }
}

export interface BuilderPreset {
    id: string
    name: string
    sub: string
    /** lucide icon key resolved by the modal. */
    icon: 'split' | 'grid' | 'keyboard' | 'plus'
    split: boolean
    /** Firmware targets this preset naturally builds for — preselected on apply
     *  (wireless/split → ZMK; ortho / macro / numpad → QMK + VIA). */
    firmware: string[]
    /** Controller identity for well-known boards — seeded on apply so the export
     *  readiness check isn't flagging a board the preset already implies (e.g. the
     *  Corne is a nice_nano_v2 + corne_left shield). Omitted where the MCU is a
     *  genuine user choice (generic ortho / numpad / macro). */
    controller?: { board?: string; shield?: string }
    /** Physical layout + base-layer legend. */
    build: () => PresetBuild
}

// pattern-check: skip additive firmware/build fields on preset data literals, no abstraction
export const PRESETS: BuilderPreset[] = [
    {
        id: 'corne',
        name: 'Corne / split 42',
        sub: '3×6 + 3 thumbs, split',
        icon: 'split',
        split: true,
        firmware: ['zmk'],
        controller: { board: 'nice_nano_v2', shield: 'corne_left' },
        build: presetCorne,
    },
    {
        id: 'ortho',
        name: 'Ortho 4×12',
        sub: 'Planck-style grid',
        icon: 'grid',
        split: false,
        firmware: ['qmk', 'via'],
        build: () => ({ keys: presetOrtho(12, 4), tokens: ORTHO_TOKENS }),
    },
    {
        id: 'sixty',
        name: '60% ANSI',
        sub: 'Compact staggered',
        icon: 'keyboard',
        split: false,
        firmware: ['qmk', 'via'],
        build: preset60,
    },
    {
        id: 'numpad',
        name: 'Numpad',
        sub: '17-key number pad',
        icon: 'grid',
        split: false,
        firmware: ['qmk', 'via'],
        build: presetNumpad,
    },
    {
        id: 'macro3',
        name: 'Macropad 3×3',
        sub: '9-key macro grid',
        icon: 'grid',
        split: false,
        firmware: ['qmk', 'via'],
        build: () => ({
            keys: presetOrtho(3, 3),
            tokens: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9'],
        }),
    },
    {
        id: 'blank',
        name: 'Blank canvas',
        sub: 'Start from nothing',
        icon: 'plus',
        split: false,
        firmware: ['zmk'],
        build: () => ({ keys: [key({})], tokens: [''] }),
    },
]

/** Preset the builder seeds when it opens with no config — so closing the start
 *  dialog without picking still leaves a complete, usable board (not a grid of
 *  transparent placeholders). The Corne is the showcase default. */
export const DEFAULT_PRESET_ID = 'corne'

// pattern-check: skip thin compose of newBoardConfig + applyPresetGeometry for the default seed, no abstraction
/** Build a complete starting config from the default preset (full geometry +
 *  base-layer legend + firmware/split/controller). Used as the builder's first-open
 *  seed; mirrors picking that preset from the "Build from" modal. */
export function defaultBoardConfig(): ConfigKeymap {
    const p = PRESETS.find((x) => x.id === DEFAULT_PRESET_ID) ?? PRESETS[0]
    const built = p.build()
    const base = newBoardConfig({
        name: 'My Keyboard',
        rows: 4,
        cols: 12,
        target: (p.firmware[0] as Target) ?? 'zmk',
    })
    return applyPresetGeometry(base, built.keys, {
        firmware: p.firmware,
        tokens: built.tokens,
        split: p.split,
        controller: p.controller,
    })
}

/* ── KLE raw-data → geometry ───────────────────────────────────────────── */

export interface KleResult {
    keys?: CanonGeometry[]
    error?: string
}

/** Parse keyboard-layout-editor.com "Raw data" into geometry. Positional (legend
 *  text is ignored — production keys carry no legend). Ported from parseKLE. */
export function parseKleGeometry(text: string): KleResult {
    let arr: unknown
    try {
        arr = JSON.parse(text)
    } catch {
        try {
            arr = JSON.parse('[' + text + ']')
        } catch {
            return {
                error: 'Not valid JSON. Paste the "Raw data" from the KLE Download menu.',
            }
        }
    }
    if (!Array.isArray(arr))
        return { error: 'Expected a top-level array of rows.' }
    const keys: CanonGeometry[] = []
    let x = 0
    let y = 0
    let w = 1
    let h = 1
    let r = 0
    let rx = 0
    let ry = 0
    for (const row of arr) {
        if (!Array.isArray(row)) continue // metadata object — skip
        for (const item of row) {
            if (item && typeof item === 'object') {
                const it = item as Record<string, number>
                if ('r' in it) r = it.r
                if ('rx' in it) {
                    rx = it.rx
                    x = rx
                    y = ry
                }
                if ('ry' in it) {
                    ry = it.ry
                    y = ry
                }
                if ('x' in it) x += it.x
                if ('y' in it) y += it.y
                if ('w' in it) w = it.w
                if ('h' in it) h = it.h
            } else {
                keys.push(
                    key({
                        x: r3(x),
                        y: r3(y),
                        w,
                        h,
                        r,
                        ...(r ? { rx, ry } : {}),
                    }),
                )
                x += w
                w = 1
                h = 1
            }
        }
        x = rx
        y += 1
    }
    if (!keys.length) return { error: 'No keys found in that data.' }
    return { keys: normalizeBoard(keys) }
}
