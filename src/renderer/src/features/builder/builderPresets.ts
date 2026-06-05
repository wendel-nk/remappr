// Pattern check: no GoF pattern (-) — rejected — preset data + pure geometry
// builder functions + a positional KLE→geometry parser; plain data construction
// ported from app/builder/BuilderData.jsx, no polymorphic hierarchy warranted.
//
// Starting-point geometries for the Keyboard Builder "Build from" menu. Each
// preset returns a `CanonGeometry[]` (the production geometry shape — x/y/w/h/r
// + optional pivot); legends and matrix wiring are NOT part of CanonGeometry, so
// presets seed physical layout only and the base layer starts transparent.
// `guessCategory` is kept (legend → cap-tint category) for the later binding pass.

import type { KeyCategory } from '@/lib/keymap/keyCategory'
import type { CanonGeometry } from '@firmware/config'
import { normalizeBoard } from './builderMatrix'

const r3 = (v: number): number => Math.round(v * 1000) / 1000

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

function presetNumpad(): CanonGeometry[] {
    const k: CanonGeometry[] = []
    const grid = [
        ['Num', '/', '*', '-'],
        ['7', '8', '9'],
        ['4', '5', '6'],
        ['1', '2', '3'],
        ['0', '.'],
    ]
    grid.forEach((rw, y) =>
        rw.forEach((lg, x) => k.push(key({ x, y, w: lg === '0' ? 2 : 1 }))),
    )
    k.push(key({ x: 3, y: 1, h: 2 })) // +
    k.push(key({ x: 3, y: 3, h: 2 })) // Enter
    return k
}

function preset60(): CanonGeometry[] {
    const k: CanonGeometry[] = []
    const rows: Array<{ y: number; items: number[] }> = [
        { y: 0, items: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2] },
        { y: 1, items: [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5] },
        { y: 2, items: [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25] },
        { y: 3, items: [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75] },
        { y: 4, items: [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25] },
    ]
    rows.forEach(({ y, items }) => {
        let x = 0
        items.forEach((w) => {
            k.push(key({ x, y, w }))
            x += w
        })
    })
    return k
}

function presetCorne(): CanonGeometry[] {
    // 3×6 columns per half + 3 thumbs each, column-staggered split.
    const keys: CanonGeometry[] = []
    const stag = [0.66, 0.25, 0, 0.12, 0.32, 0.42]
    const SPLIT = 1.6
    const RIGHT = 6 + SPLIT
    for (let r = 0; r < 3; r++)
        for (let c = 0; c < 6; c++) {
            keys.push(key({ x: c, y: r3(r + stag[c]) }))
            keys.push(key({ x: RIGHT + c, y: r3(r + stag[5 - c]) }))
        }
    const ty = 3 + 0.55
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
        keys.push(
            key({
                x: RIGHT + 1 + i,
                y: r3(ty + (i === 2 ? 0.3 : i === 1 ? 0.12 : 0)),
                r: -(i * 6),
                rx: RIGHT + 1 + i + 0.5,
                ry: ty + 0.5,
            }),
        )
    }
    return keys
}

// pattern-check: skip additive firmware field on preset data, no abstraction
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
    build: () => CanonGeometry[]
}

export const PRESETS: BuilderPreset[] = [
    // pattern-check: skip additive firmware field on preset data literals, no abstraction
    {
        id: 'corne',
        name: 'Corne / split 42',
        sub: '3×6 + 3 thumbs, split',
        icon: 'split',
        split: true,
        firmware: ['zmk'],
        build: presetCorne,
    },
    {
        id: 'ortho',
        name: 'Ortho 4×12',
        sub: 'Planck-style grid',
        icon: 'grid',
        split: false,
        firmware: ['qmk', 'via'],
        build: () => presetOrtho(12, 4),
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
        build: () => presetOrtho(3, 3),
    },
    {
        id: 'blank',
        name: 'Blank canvas',
        sub: 'Start from nothing',
        icon: 'plus',
        split: false,
        firmware: ['zmk'],
        build: () => [key({})],
    },
]

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
