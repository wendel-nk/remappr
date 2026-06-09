// Pattern check: no GoF pattern (-) — rejected — preset data + pure geometry
// builder functions + a positional KLE→geometry parser; plain data construction
// ported from app/builder/BuilderData.jsx, no polymorphic hierarchy warranted.
//
// Starting-point boards for the "Build from" menu. Each preset returns a
// `PresetBuild` = `{ keys: CanonGeometry[], tokens: string[] }`: the physical
// layout AND a base-layer legend (index-aligned to `keys`) so a preset lands as a
// usable keymap, not a board of pass-throughs. `tokens` are keycode strings the
// builder resolves to bindings via `actionFromToken`; an empty/unknown token
// becomes a transparent key.

import { round3 } from '@/lib/clampInt'
import type {
    CanonAction,
    CanonGeometry,
    ConfigKeymap,
    Target,
} from '@firmware/config'
import { resolveKeycode } from '@firmware/config'
import { normalizeBoard } from './builderMatrix'
import {
    ORTHO_TOKENS,
    key,
    preset60,
    presetCorne,
    presetNumpad,
    presetOrtho,
} from './builderPresetGeometries'
import { newBoardConfig, replaceGeometry } from './geometryEditor'

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

// pattern-check: skip mechanical code-motion — guessCategory deleted as dead, geometry builders relocated to builderPresetGeometries.ts
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
                        x: round3(x),
                        y: round3(y),
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
