// Pattern check: no GoF pattern (-) — rejected — additive pure config transforms
// for the right inspector (per-key matrix wiring / bulk align+size / quick binding
// parse+set / physical-layout variant CRUD); immutable data edits, no abstraction.
//
// The right inspector edits a single key or a multi-selection. Geometry edits reuse
// geometryEditor (updateKey/updateKeys). The matrix is the real electrical
// transform (keyboard.hardware.transform) — these helpers create it lazily from
// position (autoMatrix) the first time the user wires a key by hand, then patch
// individual [row,col] entries. Quick bindings cover the common case (a keycode /
// "Ctrl+C" / transparent / none) via the existing normalize/denormalize seam;
// richer actions (layer, tap-hold, macros) stay for the editor / Monaco panel.

import type {
    CanonAction,
    CanonKeyboardMatrix,
    CanonLayout,
    CanonMatrixTransform,
    CanonSliderBinding,
    ConfigKeymap,
    SliderMap,
} from '@firmware/config'
import {
    denormalizeAction,
    isKnownKeyToken,
    materializeMatrix,
    matrixDims,
    normalizeAction,
    resolveKeyMatrix,
} from '@firmware/config'
import { updateKey, updateKeys } from './geometryEditor'

/* ── per-key matrix wiring (writes keys[].matrix, the friendly source of truth) ── */

/** [row, col] for one key — explicit `keys[].matrix`, else a legacy transform
 *  entry, else position-derived (precedence enforced by `resolveKeyMatrix`). */
export function keyMatrix(
    config: ConfigKeymap,
    index: number,
): [number, number] {
    return resolveKeyMatrix(config)[index] ?? [0, 0]
}

/** A transform-shaped view (dims + per-key [row,col]) of the resolved wiring, for
 *  the canvas overlay. NOT stored — derived from `keys[].matrix` / geometry. */
export function resolvedTransform(config: ConfigKeymap): CanonMatrixTransform {
    const { rows, cols } = matrixDims(config)
    return { rows, columns: cols, map: resolveKeyMatrix(config) }
}

/** Auto-assign is on when NO key carries an explicit `matrix`: the wiring is then
 *  derived from key positions and tracks moves. Wiring a key by hand turns it off. */
export function isAutoAssign(config: ConfigKeymap): boolean {
    return !config.keyboard.keys.some((k) => k.matrix)
}

/** Freeze the resolved wiring into explicit `keys[].matrix` + the board
 *  `keyboard.matrix` descriptor (the "Auto" action / auto-assign off). */
export function applyAutoMatrix(config: ConfigKeymap): ConfigKeymap {
    return materializeMatrix(config)
}

/** Clear every explicit `keys[].matrix` → wiring reverts to position-derived
 *  (auto-assign on). Keeps the descriptor's diode/mode (re-derives its dims) and
 *  drops any legacy transform so it can't re-freeze the wiring. */
export function clearMatrix(config: ConfigKeymap): ConfigKeymap {
    const keys = config.keyboard.keys.map((k) => {
        if (!k.matrix) return k
        const rest = { ...k }
        delete rest.matrix
        return rest
    })
    const keyboard = { ...config.keyboard, keys }
    if (keyboard.hardware?.transform) {
        const hardware = { ...keyboard.hardware }
        delete hardware.transform
        if (Object.keys(hardware).length) keyboard.hardware = hardware
        else delete keyboard.hardware
    }
    if (keyboard.matrix) {
        const { diodeDirection, mode } = keyboard.matrix
        if (diodeDirection || mode) {
            const dims = matrixDims({ ...config, keyboard })
            keyboard.matrix = { ...dims, diodeDirection, mode }
        } else delete keyboard.matrix
    }
    return { ...config, keyboard }
}

/** Patch the board matrix descriptor (diode direction / scan mode), keeping its
 *  dims in sync with the current wiring. Lazily creates `keyboard.matrix`. */
export function setMatrixMeta(
    config: ConfigKeymap,
    patch: Partial<CanonKeyboardMatrix>,
): ConfigKeymap {
    const { rows, cols } = matrixDims(config)
    const matrix: CanonKeyboardMatrix = {
        ...config.keyboard.matrix,
        ...patch,
        rows,
        cols,
    }
    return { ...config, keyboard: { ...config.keyboard, matrix } }
}

/** Set one key's [row, col] (writes the friendly `keys[].matrix`). */
export function setKeyMatrix(
    config: ConfigKeymap,
    index: number,
    row: number,
    col: number,
): ConfigKeymap {
    return updateKey(config, index, { matrix: [row, col] })
}

/** Set every selected key to one row (preserving each key's resolved column). */
export function bulkSetRow(
    config: ConfigKeymap,
    indices: Iterable<number>,
    row: number,
): ConfigKeymap {
    const sel = new Set(indices)
    const resolved = resolveKeyMatrix(config)
    return updateKeys(config, (k, i) =>
        sel.has(i) ? { ...k, matrix: [row, resolved[i]?.[1] ?? 0] } : k,
    )
}

/** Number the selected keys' columns left→right starting at `startCol`
 *  (preserving each key's resolved row). */
export function bulkNumberCols(
    config: ConfigKeymap,
    indices: Iterable<number>,
    startCol: number,
): ConfigKeymap {
    const ordered = [...new Set(indices)].sort(
        (a, b) => config.keyboard.keys[a].x - config.keyboard.keys[b].x,
    )
    const colOf = new Map(ordered.map((idx, i) => [idx, startCol + i]))
    const resolved = resolveKeyMatrix(config)
    return updateKeys(config, (k, i) =>
        colOf.has(i)
            ? { ...k, matrix: [resolved[i]?.[0] ?? 0, colOf.get(i)!] }
            : k,
    )
}

/* ── bulk geometry (multi-select) ──────────────────────────────────────── */

export type AlignMode = 'left' | 'top' | 'sameRow' | 'sameCol' | 'size1'

/** Align / resize the selected keys. left/sameCol → common X; top/sameRow → common Y. */
export function bulkGeometry(
    config: ConfigKeymap,
    indices: Iterable<number>,
    mode: AlignMode,
): ConfigKeymap {
    const sel = new Set(indices)
    const picked = config.keyboard.keys.filter((_, i) => sel.has(i))
    if (!picked.length) return config
    const minX = Math.min(...picked.map((k) => k.x))
    const minY = Math.min(...picked.map((k) => k.y))
    return updateKeys(config, (k, i) => {
        if (!sel.has(i)) return k
        switch (mode) {
            case 'left':
            case 'sameCol':
                return { ...k, x: minX }
            case 'top':
            case 'sameRow':
                return { ...k, y: minY }
            case 'size1':
                return { ...k, w: 1, h: 1 }
            default:
                return k
        }
    })
}

/* ── single-key geometry patch (thin wrapper for the inspector) ────────── */

export const patchKey = updateKey

/* ── quick bindings (active layer) ─────────────────────────────────────── */

/** Display token for a binding row: the friendly key/combo for a key_press,
 *  '▽' for transparent, or the action type otherwise. */
export function bindingLabel(action: CanonAction | undefined): string {
    if (!action || action.type === 'transparent') return '▽'
    const surface = denormalizeAction(action)
    if (typeof surface === 'string') return surface
    return String(surface.type ?? action.type)
}

/** Parse a typed token into a binding. Empty/▽/trans → transparent; none → none;
 *  a known keycode / "Ctrl+C" combo → key_press; otherwise null (rejected). */
export function parseBindingToken(token: string): CanonAction | null {
    const t = token.trim()
    if (!t || t === '▽' || /^(trans|transparent)$/i.test(t)) {
        return { type: 'transparent' }
    }
    if (/^none$/i.test(t)) return { type: 'none' }
    if (isKnownKeyToken(t)) return normalizeAction(t)
    return null
}

/** Replace one key's binding on a layer (index-aligned to keyboard.keys). */
export function setBinding(
    config: ConfigKeymap,
    layerIndex: number,
    keyIndex: number,
    action: CanonAction,
): ConfigKeymap {
    return {
        ...config,
        layers: config.layers.map((l, li) =>
            li === layerIndex
                ? {
                      ...l,
                      bindings: l.bindings.map((b, ki) =>
                          ki === keyIndex ? action : b,
                      ),
                  }
                : l,
        ),
    }
}

// pattern-check: skip additive pure config transform mirroring setBinding, no abstraction
/** Rotary slot of a per-key encoder binding (the non-`key` BindingSlots). */
export type EncoderSlot = 'cw' | 'ccw' | 'press'

/** Set one rotary slot of a key's encoder binding on a layer, keyed by the key's
 *  index in `keyboard.keys`. Lazily creates `layer.encoderBindings` + the per-key
 *  entry; cw/ccw are required by the type, so a fresh entry defaults the untouched
 *  rotary direction to transparent (press stays absent). */
export function setEncoderBinding(
    config: ConfigKeymap,
    layerIndex: number,
    keyIndex: number,
    slot: EncoderSlot,
    action: CanonAction,
): ConfigKeymap {
    const trans: CanonAction = { type: 'transparent' }
    return {
        ...config,
        layers: config.layers.map((l, li) => {
            if (li !== layerIndex) return l
            const prev = l.encoderBindings?.[keyIndex]
            const entry = prev ?? { cw: trans, ccw: trans }
            return {
                ...l,
                encoderBindings: {
                    ...l.encoderBindings,
                    [keyIndex]: { ...entry, [slot]: action },
                },
            }
        }),
    }
}

// pattern-check: skip additive pure config transforms mirroring setEncoderBinding, no abstraction
/** Set or patch a key's slider value-map on a layer, keyed by the key's index in
 *  `keyboard.keys`. Lazily creates `layer.sliderBindings` + the per-key entry
 *  (a fresh entry defaults to `map: "volume"`). Pass a partial patch. */
export function setSliderBinding(
    config: ConfigKeymap,
    layerIndex: number,
    keyIndex: number,
    patch: Partial<CanonSliderBinding>,
): ConfigKeymap {
    return {
        ...config,
        layers: config.layers.map((l, li) => {
            if (li !== layerIndex) return l
            const prev: CanonSliderBinding = l.sliderBindings?.[keyIndex] ?? {
                map: 'volume',
            }
            return {
                ...l,
                sliderBindings: {
                    ...l.sliderBindings,
                    [keyIndex]: { ...prev, ...patch },
                },
            }
        }),
    }
}

/** Remove a key's slider value-map from a layer (drops the per-key entry). */
export function clearSliderBinding(
    config: ConfigKeymap,
    layerIndex: number,
    keyIndex: number,
): ConfigKeymap {
    return {
        ...config,
        layers: config.layers.map((l, li) => {
            if (li !== layerIndex || !l.sliderBindings?.[keyIndex]) return l
            const next = { ...l.sliderBindings }
            delete next[keyIndex]
            return { ...l, sliderBindings: next }
        }),
    }
}

/** Slider value-map options, in display order. */
export const SLIDER_MAPS: { value: SliderMap; label: string }[] = [
    { value: 'volume', label: 'Volume' },
    { value: 'brightness', label: 'Brightness' },
    { value: 'mouse_wheel', label: 'Mouse wheel' },
    { value: 'custom', label: 'Custom action' },
]

/* ── physical-layout variants ──────────────────────────────────────────── */

const nextVariantId = (existing: CanonLayout[]): string => {
    const used = new Set(existing.map((l) => l.id))
    let n = existing.length + 1
    while (used.has(`variant_${n}`)) n++
    return `variant_${n}`
}

/** Append a layout variant. Returns the new config + the new variant id. */
export function addLayout(config: ConfigKeymap): {
    config: ConfigKeymap
    id: string
} {
    const layouts = config.keyboard.layouts ?? []
    const id = nextVariantId(layouts)
    const layout: CanonLayout = { id, name: `Variant ${layouts.length + 1}` }
    return {
        config: {
            ...config,
            keyboard: { ...config.keyboard, layouts: [...layouts, layout] },
        },
        id,
    }
}

export function renameLayout(
    config: ConfigKeymap,
    id: string,
    name: string,
): ConfigKeymap {
    const trimmed = name.trim()
    if (!trimmed) return config
    return {
        ...config,
        keyboard: {
            ...config.keyboard,
            layouts: (config.keyboard.layouts ?? []).map((l) =>
                l.id === id ? { ...l, name: trimmed } : l,
            ),
        },
    }
}

/** Remove a layout variant + clear it from any key tagged into it. */
export function removeLayout(config: ConfigKeymap, id: string): ConfigKeymap {
    const layouts = (config.keyboard.layouts ?? []).filter((l) => l.id !== id)
    const keys = config.keyboard.keys.map((k) =>
        k.variant === id ? { ...k, variant: undefined } : k,
    )
    const keyboard = { ...config.keyboard, keys }
    if (layouts.length) keyboard.layouts = layouts
    else delete keyboard.layouts
    return { ...config, keyboard }
}

/** Tag one key into a variant ("" / undefined = common to all variants). */
export function setKeyVariant(
    config: ConfigKeymap,
    index: number,
    variant: string,
): ConfigKeymap {
    return updateKey(config, index, { variant: variant || undefined })
}
