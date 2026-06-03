// Pattern check: no GoF pattern (-) — rejected — pure geometry/config factory
// functions for from-scratch boards; data construction, no abstraction.
//
// Builds the geometry (and a seed config) for a board designed from scratch in
// the Keyboard Builder. The first editor increment is a uniform grid: 1u keys at
// integer key-unit positions, row-major. Because each key sits at x=col / y=row,
// the compiler's geometry-derived matrix-transform already collapses to the exact
// grid RC() map — so no separate transform editor is needed for grids. Free-form
// drag/resize per key is a later phase.

import type {
    CanonGeometry,
    ConfigKeyboard,
    ConfigKeymap,
    Target,
} from '@firmware/config'

export const MAX_GRID = 24

/** Clamp a requested grid dimension into 1..MAX_GRID (integer). */
export function clampDim(n: number): number {
    if (!Number.isFinite(n)) return 1
    return Math.min(MAX_GRID, Math.max(1, Math.floor(n)))
}

/** A row-major grid of 1u keys: key i sits at (col, row). */
export function gridKeys(rows: number, cols: number): CanonGeometry[] {
    const r = clampDim(rows)
    const c = clampDim(cols)
    const keys: CanonGeometry[] = []
    for (let y = 0; y < r; y++) {
        for (let x = 0; x < c; x++) {
            keys.push({ x, y, w: 1, h: 1, r: 0 })
        }
    }
    return keys
}

/** Slugify a board name into a devicetree-safe id (lowercase, `_`-joined). */
export function slugifyId(name: string): string {
    const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
    return slug || 'board'
}

export interface NewBoardOptions {
    name: string
    rows: number
    cols: number
    target: Target | null
}

// Pattern check: no GoF pattern (-) — rejected — plain form-state data interface
// relocated here for react-refresh; no behavior, no abstraction.
/** The new-board form's editable shape (rows/cols are strings while typing).
 *  Lives here, not in NewBoardForm.tsx, so that file exports only its component
 *  (react-refresh). */
export interface NewBoardDraft {
    name: string
    target: Target
    rows: string
    cols: string
}

export const EMPTY_BOARD_DRAFT: NewBoardDraft = {
    name: '',
    target: 'zmk',
    rows: '4',
    cols: '12',
}

/** Seed a fresh canonical config for a grid board: one `base` layer of inert
 *  placeholders sized to the grid, ready for the user to assign keys + hardware. */
export function newBoardConfig(opts: NewBoardOptions): ConfigKeymap {
    const name = opts.name.trim() || 'Custom Board'
    const keys = gridKeys(opts.rows, opts.cols)
    return {
        schemaVersion: 1,
        kind: 'remappr.keymap',
        meta: { name, target: opts.target },
        keyboard: { id: slugifyId(name), name, keys },
        layers: [
            {
                name: 'base',
                bindings: keys.map(() => ({ type: 'transparent' as const })),
            },
        ],
    }
}

// Pattern check: no GoF pattern (-) — rejected — pure config-edit functions that
// keep keys / per-layer bindings / combos consistent; immutable data transforms.

// A structural edit (add/remove key) invalidates a hand-authored electrical
// transform (its map no longer matches the key set), so drop it and let the
// compiler re-derive from geometry. Returns hardware-less keyboard if that was
// the only hardware field.
function withoutTransform(kb: ConfigKeyboard): ConfigKeyboard {
    if (!kb.hardware?.transform) return kb
    const hardware = { ...kb.hardware }
    delete hardware.transform
    const next = { ...kb }
    if (Object.keys(hardware).length) next.hardware = hardware
    else delete next.hardware
    return next
}

/** Replace one key's geometry (position/size/rotation) — no structural change. */
export function updateKey(
    config: ConfigKeymap,
    index: number,
    patch: Partial<CanonGeometry>,
): ConfigKeymap {
    const keys = config.keyboard.keys.map((k, i) =>
        i === index ? { ...k, ...patch } : k,
    )
    return { ...config, keyboard: { ...config.keyboard, keys } }
}

/** Append a key (+ a transparent binding on every layer). */
export function addKey(
    config: ConfigKeymap,
    key?: CanonGeometry,
): ConfigKeymap {
    const keys = config.keyboard.keys
    const last = keys[keys.length - 1]
    const newKey: CanonGeometry = key ?? {
        x: last ? last.x + 1 : 0,
        y: last ? last.y : 0,
        w: 1,
        h: 1,
        r: 0,
    }
    return {
        ...config,
        keyboard: withoutTransform({
            ...config.keyboard,
            keys: [...keys, newKey],
        }),
        layers: config.layers.map((l) => ({
            ...l,
            bindings: [...l.bindings, { type: 'transparent' as const }],
        })),
    }
}

/** Remove the key at `index` (+ its per-layer binding); fix combo key positions.
 *  No-op if it would leave zero keys. */
export function removeKey(config: ConfigKeymap, index: number): ConfigKeymap {
    if (config.keyboard.keys.length <= 1) return config
    const keys = config.keyboard.keys.filter((_, i) => i !== index)
    const combos = config.combos
        ? config.combos
              .filter((c) => !c.keys.includes(index))
              .map((c) => ({
                  ...c,
                  keys: c.keys.map((k) => (k > index ? k - 1 : k)),
              }))
        : undefined
    return {
        ...config,
        keyboard: withoutTransform({ ...config.keyboard, keys }),
        layers: config.layers.map((l) => ({
            ...l,
            bindings: l.bindings.filter((_, i) => i !== index),
            ...(l.encoders ? { encoders: l.encoders } : {}),
        })),
        ...(combos ? { combos } : {}),
    }
}
