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

import {
    denormalizeAction,
    isKnownKeyToken,
    normalizeAction,
} from '@firmware/config'
import type {
    CanonAction,
    CanonLayout,
    CanonMatrixTransform,
    CanonSliderBinding,
    ConfigKeymap,
    SliderMap,
} from '@firmware/config'
import { autoMatrix } from './builderMatrix'
import { updateKey, updateKeys } from './geometryEditor'

const r3 = (v: number): number => Math.round(v * 1000) / 1000

/* ── per-key matrix wiring (lazily materialises the transform) ──────────── */

/** The current electrical transform, or one freshly derived from key positions. */
export function ensureTransform(config: ConfigKeymap): CanonMatrixTransform {
    return (
        config.keyboard.hardware?.transform ?? autoMatrix(config.keyboard.keys)
    )
}

/** [row, col] for one key — from the committed transform or position-derived. */
export function keyMatrix(
    config: ConfigKeymap,
    index: number,
): [number, number] {
    const t = ensureTransform(config)
    return t.map[index] ?? [0, 0]
}

const withTransform = (
    config: ConfigKeymap,
    transform: CanonMatrixTransform,
): ConfigKeymap => ({
    ...config,
    keyboard: {
        ...config.keyboard,
        hardware: { ...config.keyboard.hardware, transform },
    },
})

/** Commit a position-derived transform (the "Auto" action). */
export function applyAutoMatrix(config: ConfigKeymap): ConfigKeymap {
    return withTransform(config, autoMatrix(config.keyboard.keys))
}

// pattern-check: skip additive pure transform-drop op + boolean accessor, no abstraction
/** Drop the stored electrical transform → the matrix reverts to being derived
 *  from key positions (auto-assign on). Inverse of `applyAutoMatrix`. */
export function removeTransform(config: ConfigKeymap): ConfigKeymap {
    if (!config.keyboard.hardware?.transform) return config
    const hardware = { ...config.keyboard.hardware }
    delete hardware.transform
    const keyboard = { ...config.keyboard }
    if (Object.keys(hardware).length) keyboard.hardware = hardware
    else delete keyboard.hardware
    return { ...config, keyboard }
}

/** Auto-assign is on when no electrical transform is stored — the matrix is then
 *  derived from key positions and tracks moves automatically. */
export function isAutoAssign(config: ConfigKeymap): boolean {
    return !config.keyboard.hardware?.transform
}

/** Set one key's [row, col], materialising + growing the transform as needed. */
export function setKeyMatrix(
    config: ConfigKeymap,
    index: number,
    row: number,
    col: number,
): ConfigKeymap {
    const t = ensureTransform(config)
    const map = t.map.map((rc, i): [number, number] =>
        i === index ? [row, col] : rc,
    )
    return withTransform(config, {
        rows: Math.max(t.rows, row + 1),
        columns: Math.max(t.columns, col + 1),
        map,
    })
}

/** Set every selected key to one row (matrix). */
export function bulkSetRow(
    config: ConfigKeymap,
    indices: Iterable<number>,
    row: number,
): ConfigKeymap {
    const sel = new Set(indices)
    const t = ensureTransform(config)
    const map = t.map.map((rc, i): [number, number] =>
        sel.has(i) ? [row, rc[1]] : rc,
    )
    return withTransform(config, {
        rows: Math.max(t.rows, row + 1),
        columns: t.columns,
        map,
    })
}

/** Number the selected keys' columns left→right starting at `startCol`. */
export function bulkNumberCols(
    config: ConfigKeymap,
    indices: Iterable<number>,
    startCol: number,
): ConfigKeymap {
    const ordered = [...new Set(indices)].sort(
        (a, b) => config.keyboard.keys[a].x - config.keyboard.keys[b].x,
    )
    const colOf = new Map(ordered.map((idx, i) => [idx, startCol + i]))
    const t = ensureTransform(config)
    let maxCol = t.columns - 1
    const map = t.map.map((rc, i): [number, number] => {
        if (!colOf.has(i)) return rc
        const c = colOf.get(i)!
        maxCol = Math.max(maxCol, c)
        return [rc[0], c]
    })
    return withTransform(config, {
        rows: t.rows,
        columns: maxCol + 1,
        map,
    })
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

export { r3 }
