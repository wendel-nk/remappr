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
    CanonEncoderSlot,
    CanonGeometry,
    ConfigKeyboard,
    ConfigKeymap,
    Target,
} from '@firmware/config'

export const MAX_GRID = 24

/** Quantize a key-unit value to the nearest `step` (e.g. 0.25u), rounded to
 *  avoid float dust like 0.30000000000000004. Used by the pixel-drag handles. */
export function snap(value: number, step: number): number {
    if (step <= 0) return value
    return Math.round(Math.round(value / step) * step * 1e6) / 1e6
}

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

// Pattern check: no GoF pattern (-) — rejected — additive pure multi-key config
// transforms (map/duplicate/remove); immutable data edits, no abstraction.

/** Map every key through `mapper` (immutable). Geometry-only — does not touch
 *  the matrix transform, so callers that move/resize/rotate keys keep any
 *  hand-authored transform intact (positions changing don't invalidate RC()). */
export function updateKeys(
    config: ConfigKeymap,
    mapper: (key: CanonGeometry, index: number) => CanonGeometry,
): ConfigKeymap {
    const keys = config.keyboard.keys.map(mapper)
    return { ...config, keyboard: { ...config.keyboard, keys } }
}

/** Duplicate the keys at `indices` (offset +0.25u) + their per-layer bindings.
 *  Returns the new config and the indices of the freshly-appended copies. */
export function duplicateKeys(
    config: ConfigKeymap,
    indices: Iterable<number>,
): { config: ConfigKeymap; newIndices: number[] } {
    const list = [...new Set(indices)].sort((a, b) => a - b)
    const base = config.keyboard.keys.length
    const dups = list
        .map((i) => config.keyboard.keys[i])
        .filter(Boolean)
        .map((k) => ({ ...k, x: k.x + 0.25, y: k.y + 0.25 }))
    if (!dups.length) return { config, newIndices: [] }
    const newIndices = dups.map((_, j) => base + j)
    return {
        config: {
            ...config,
            keyboard: withoutTransform({
                ...config.keyboard,
                keys: [...config.keyboard.keys, ...dups],
            }),
            layers: config.layers.map((l) => ({
                ...l,
                bindings: [
                    ...l.bindings,
                    ...dups.map(() => ({ type: 'transparent' as const })),
                ],
            })),
        },
        newIndices,
    }
}

/** Remove every key in `indices` (+ per-layer bindings); fix combo key refs.
 *  No-op if it would leave zero keys. */
export function removeKeys(
    config: ConfigKeymap,
    indices: Iterable<number>,
): ConfigKeymap {
    const drop = new Set(indices)
    if (!drop.size) return config
    if (config.keyboard.keys.length - drop.size < 1) return config
    // Map old index → new index (or -1 if dropped) for combo remapping.
    let next = 0
    const remap = config.keyboard.keys.map((_, i) =>
        drop.has(i) ? -1 : next++,
    )
    const keys = config.keyboard.keys.filter((_, i) => !drop.has(i))
    const combos = config.combos
        ? config.combos
              .filter((c) => !c.keys.some((k) => drop.has(k)))
              .map((c) => ({ ...c, keys: c.keys.map((k) => remap[k]) }))
        : undefined
    return {
        ...config,
        keyboard: withoutTransform({ ...config.keyboard, keys }),
        layers: config.layers.map((l) => ({
            ...l,
            bindings: l.bindings.filter((_, i) => !drop.has(i)),
        })),
        ...(combos ? { combos } : {}),
    }
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

// Pattern check: no GoF pattern (-) — rejected — additive pure config transforms
// (geometry replace + layer add/rename/dup/remove); immutable data edits that keep
// every layer's binding array index-aligned to the key set, no abstraction.

/** A transparent binding for every key on a layer of `count` keys. */
const transparentBindings = (count: number): { type: 'transparent' }[] =>
    Array.from({ length: count }, () => ({ type: 'transparent' as const }))

/** Replace the whole physical layout (preset / grid / KLE import). Keeps layer
 *  NAMES but resets every layer to transparent bindings sized to the new key
 *  count, and drops encoders + any hand-authored transform (now stale). */
export function replaceGeometry(
    config: ConfigKeymap,
    keys: CanonGeometry[],
): ConfigKeymap {
    const safe = keys.length ? keys : [{ x: 0, y: 0, w: 1, h: 1, r: 0 }]
    const keyboard = withoutTransform({ ...config.keyboard, keys: safe })
    delete keyboard.encoders
    return {
        ...config,
        keyboard,
        layers: config.layers.map((l) => ({
            name: l.name,
            ...(l.description ? { description: l.description } : {}),
            bindings: transparentBindings(safe.length),
        })),
    }
}

/** Append a new layer (transparent bindings + encoder bindings sized to board). */
export function addLayer(config: ConfigKeymap, name?: string): ConfigKeymap {
    const keyCount = config.keyboard.keys.length
    const encCount = config.keyboard.encoders?.length ?? 0
    const layer: ConfigKeymap['layers'][number] = {
        name: name?.trim() || `layer_${config.layers.length}`,
        bindings: transparentBindings(keyCount),
        ...(encCount
            ? {
                  encoders: Array.from({ length: encCount }, () => ({
                      cw: { type: 'transparent' as const },
                      ccw: { type: 'transparent' as const },
                  })),
              }
            : {}),
    }
    return { ...config, layers: [...config.layers, layer] }
}

/** Rename the layer at `index` (no-op for an empty name). */
export function renameLayer(
    config: ConfigKeymap,
    index: number,
    name: string,
): ConfigKeymap {
    const trimmed = name.trim()
    if (!trimmed) return config
    return {
        ...config,
        layers: config.layers.map((l, i) =>
            i === index ? { ...l, name: trimmed } : l,
        ),
    }
}

/** Duplicate the layer at `index` (bindings + encoders), inserted right after it.
 *  Returns the new config and the index of the inserted copy. */
export function duplicateLayer(
    config: ConfigKeymap,
    index: number,
): { config: ConfigKeymap; newIndex: number } {
    const src = config.layers[index]
    if (!src) return { config, newIndex: index }
    const copy: ConfigKeymap['layers'][number] = {
        name: `${src.name} copy`,
        ...(src.description ? { description: src.description } : {}),
        bindings: src.bindings.map((b) => ({ ...b })),
        ...(src.encoders
            ? { encoders: src.encoders.map((e) => ({ ...e })) }
            : {}),
    }
    const layers = [...config.layers]
    layers.splice(index + 1, 0, copy)
    return { config: { ...config, layers }, newIndex: index + 1 }
}

/** Remove the layer at `index`. No-op if it would leave zero layers. */
export function removeLayer(config: ConfigKeymap, index: number): ConfigKeymap {
    if (config.layers.length <= 1) return config
    return {
        ...config,
        layers: config.layers.filter((_, i) => i !== index),
    }
}

// Encoder PHYSICAL slots live on keyboard.encoders[]; their per-layer behavior
// (cw/ccw/press) lives on layers[].encoders[] aligned by the same index. The
// builder's geometry editor only places the physical slots — keeping the two
// index-aligned is the helpers' job (add appends, remove splices both sides).

/** Append a physical encoder slot. Defaults near the layout origin. */
export function addEncoder(
    config: ConfigKeymap,
    slot?: CanonEncoderSlot,
): ConfigKeymap {
    const encoders = config.keyboard.encoders ?? []
    const next: CanonEncoderSlot = slot ?? { x: 0, y: 0 }
    return {
        ...config,
        keyboard: { ...config.keyboard, encoders: [...encoders, next] },
    }
}

/** Move one encoder slot (patch x/y) — no structural change. */
export function updateEncoder(
    config: ConfigKeymap,
    index: number,
    patch: Partial<CanonEncoderSlot>,
): ConfigKeymap {
    const encoders = (config.keyboard.encoders ?? []).map((e, i) =>
        i === index ? { ...e, ...patch } : e,
    )
    return {
        ...config,
        keyboard: { ...config.keyboard, encoders },
    }
}

/** Remove the encoder slot at `index` and its aligned per-layer binding.
 *  Drops the `encoders` field entirely when the last slot is removed. */
export function removeEncoder(
    config: ConfigKeymap,
    index: number,
): ConfigKeymap {
    const current = config.keyboard.encoders
    if (!current || index < 0 || index >= current.length) return config
    const encoders = current.filter((_, i) => i !== index)
    const keyboard = { ...config.keyboard }
    if (encoders.length) keyboard.encoders = encoders
    else delete keyboard.encoders
    return {
        ...config,
        keyboard,
        layers: config.layers.map((l) =>
            l.encoders
                ? { ...l, encoders: l.encoders.filter((_, i) => i !== index) }
                : l,
        ),
    }
}
