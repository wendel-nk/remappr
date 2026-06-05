// Pattern check: no GoF pattern (-) — rejected — unit tests for pure inspector ops
// (per-key matrix / bulk / binding / variant); assertions over data, no abstraction.
import { describe, expect, it } from 'vitest'
import { parseKeymap, serializeKeymap } from '@firmware/config'
import type { ConfigKeymap } from '@firmware/config'
import { newBoardConfig } from './geometryEditor'
import {
    addLayout,
    applyAutoMatrix,
    bindingLabel,
    bulkGeometry,
    bulkNumberCols,
    bulkSetRow,
    ensureTransform,
    isAutoAssign,
    keyMatrix,
    parseBindingToken,
    patchKey,
    removeLayout,
    removeTransform,
    renameLayout,
    setBinding,
    setEncoderBinding,
    setSliderBinding,
    clearSliderBinding,
    setKeyMatrix,
    setKeyVariant,
} from './builderInspectorOps'

const grid = (rows: number, cols: number): ConfigKeymap =>
    newBoardConfig({ name: 'B', rows, cols, target: 'zmk' })

describe('builderInspectorOps — matrix', () => {
    it('ensureTransform derives from position when none committed', () => {
        const t = ensureTransform(grid(2, 3))
        expect(t.rows).toBe(2)
        expect(t.columns).toBe(3)
        expect(t.map).toHaveLength(6)
    })

    it('applyAutoMatrix commits the derived transform', () => {
        const out = applyAutoMatrix(grid(2, 3))
        expect(out.keyboard.hardware?.transform?.rows).toBe(2)
        expect(out.keyboard.hardware?.transform?.columns).toBe(3)
        // valid against the schema (map length == key count, RC in range)
        expect(
            parseKeymap(serializeKeymap(out)).keyboard.hardware?.transform,
        ).toBeDefined()
    })

    it('setKeyMatrix materialises + grows the transform', () => {
        const out = setKeyMatrix(grid(2, 2), 0, 4, 5)
        expect(keyMatrix(out, 0)).toEqual([4, 5])
        expect(out.keyboard.hardware?.transform?.rows).toBe(5)
        expect(out.keyboard.hardware?.transform?.columns).toBe(6)
        expect(parseKeymap(serializeKeymap(out)).keyboard.keys).toHaveLength(4)
    })

    it('auto-assign reflects + toggles the stored transform', () => {
        const fresh = grid(2, 2)
        // No transform stored on a fresh board → auto-assign on.
        expect(isAutoAssign(fresh)).toBe(true)
        // Materialise (auto-assign off) then drop (auto-assign on again).
        const manual = applyAutoMatrix(fresh)
        expect(isAutoAssign(manual)).toBe(false)
        const back = removeTransform(manual)
        expect(isAutoAssign(back)).toBe(true)
        expect(back.keyboard.hardware?.transform).toBeUndefined()
        // A manual wire also turns auto-assign off.
        expect(isAutoAssign(setKeyMatrix(fresh, 0, 1, 1))).toBe(false)
    })

    it('per-key pin + element round-trip through serialize', () => {
        const out = patchKey(patchKey(grid(1, 2), 0, { pin: 'GP29' }), 0, {
            element: 'encoder',
        })
        expect(out.keyboard.keys[0].pin).toBe('GP29')
        expect(out.keyboard.keys[0].element).toBe('encoder')
        const back = parseKeymap(serializeKeymap(out)).keyboard.keys[0]
        expect(back.pin).toBe('GP29')
        expect(back.element).toBe('encoder')
    })

    it('bulkSetRow sets the row for every selected key', () => {
        const out = bulkSetRow(grid(2, 2), [0, 1], 3)
        expect(keyMatrix(out, 0)[0]).toBe(3)
        expect(keyMatrix(out, 1)[0]).toBe(3)
        expect(out.keyboard.hardware?.transform?.rows).toBe(4)
    })

    it('bulkNumberCols numbers selected columns left→right from a start', () => {
        const out = bulkNumberCols(grid(1, 3), [0, 1, 2], 5)
        expect(keyMatrix(out, 0)[1]).toBe(5)
        expect(keyMatrix(out, 1)[1]).toBe(6)
        expect(keyMatrix(out, 2)[1]).toBe(7)
        expect(out.keyboard.hardware?.transform?.columns).toBe(8)
    })
})

describe('builderInspectorOps — bulk geometry', () => {
    it('left aligns selected keys to the min X', () => {
        const out = bulkGeometry(grid(1, 3), [1, 2], 'left')
        expect(out.keyboard.keys[1].x).toBe(1)
        expect(out.keyboard.keys[2].x).toBe(1)
        expect(out.keyboard.keys[0].x).toBe(0) // untouched
    })

    it('size1 resets selected keys to 1U', () => {
        const seed = bulkGeometry(grid(1, 2), [0], 'size1')
        expect(seed.keyboard.keys[0]).toMatchObject({ w: 1, h: 1 })
    })
})

describe('builderInspectorOps — bindings', () => {
    it('parseBindingToken handles keycodes, combos, specials, and rejects junk', () => {
        expect(parseBindingToken('A')).toMatchObject({ type: 'key_press' })
        expect(parseBindingToken('Ctrl+C')).toMatchObject({ type: 'key_press' })
        expect(parseBindingToken('trans')).toEqual({ type: 'transparent' })
        expect(parseBindingToken('')).toEqual({ type: 'transparent' })
        expect(parseBindingToken('none')).toEqual({ type: 'none' })
        expect(parseBindingToken('NOPE_XYZ')).toBeNull()
    })

    it('bindingLabel round-trips a key_press to a friendly token', () => {
        const a = parseBindingToken('A')!
        expect(bindingLabel(a)).toBe('A')
        expect(bindingLabel({ type: 'transparent' })).toBe('▽')
        expect(bindingLabel(undefined)).toBe('▽')
    })

    it('setBinding replaces one binding on the active layer only', () => {
        const out = setBinding(grid(1, 2), 0, 1, parseBindingToken('B')!)
        expect(out.layers[0].bindings[1]).toMatchObject({ type: 'key_press' })
        expect(out.layers[0].bindings[0]).toEqual({ type: 'transparent' })
        expect(
            parseKeymap(serializeKeymap(out)).layers[0].bindings,
        ).toHaveLength(2)
    })

    it('setEncoderBinding seeds cw/ccw transparent then sets the slot', () => {
        // First touch (cw) lazily creates the entry; the untouched ccw defaults
        // to transparent and press stays absent.
        const out = setEncoderBinding(
            grid(1, 2),
            0,
            1,
            'cw',
            parseBindingToken('A')!,
        )
        const entry = out.layers[0].encoderBindings?.[1]
        expect(entry?.cw).toMatchObject({ type: 'key_press' })
        expect(entry?.ccw).toEqual({ type: 'transparent' })
        expect(entry?.press).toBeUndefined()
        // Other keys + layers untouched.
        expect(out.layers[0].encoderBindings?.[0]).toBeUndefined()
        // A second slot (press) preserves the existing cw.
        const out2 = setEncoderBinding(
            out,
            0,
            1,
            'press',
            parseBindingToken('B')!,
        )
        const e2 = out2.layers[0].encoderBindings?.[1]
        expect(e2?.cw).toMatchObject({ type: 'key_press' })
        expect(e2?.press).toMatchObject({ type: 'key_press' })
        // Round-trips through the schema (string-keyed encoderBindings).
        expect(
            parseKeymap(serializeKeymap(out2)).layers[0].encoderBindings?.[1]
                ?.press,
        ).toBeDefined()
    })
    it('setSliderBinding seeds map:volume then patches fields', () => {
        // First touch lazily creates the entry defaulting to volume.
        const out = setSliderBinding(grid(1, 2), 0, 1, { min: 0, max: 100 })
        const entry = out.layers[0].sliderBindings?.[1]
        expect(entry).toMatchObject({ map: 'volume', min: 0, max: 100 })
        expect(out.layers[0].sliderBindings?.[0]).toBeUndefined()
        // A later patch preserves the prior fields.
        const out2 = setSliderBinding(out, 0, 1, { map: 'custom' })
        expect(out2.layers[0].sliderBindings?.[1]).toMatchObject({
            map: 'custom',
            min: 0,
            max: 100,
        })
        // Round-trips through the schema (string-keyed sliderBindings).
        expect(
            parseKeymap(serializeKeymap(out2)).layers[0].sliderBindings?.[1]
                ?.map,
        ).toBe('custom')
    })

    it('clearSliderBinding drops the per-key entry', () => {
        const out = setSliderBinding(grid(1, 2), 0, 1, { map: 'brightness' })
        const cleared = clearSliderBinding(out, 0, 1)
        expect(cleared.layers[0].sliderBindings?.[1]).toBeUndefined()
    })
})

describe('builderInspectorOps — variants', () => {
    it('addLayout appends a variant and returns its id', () => {
        const { config, id } = addLayout(grid(1, 2))
        expect(config.keyboard.layouts).toHaveLength(1)
        expect(config.keyboard.layouts?.[0].id).toBe(id)
    })

    it('renameLayout renames by id', () => {
        const { config, id } = addLayout(grid(1, 2))
        const out = renameLayout(config, id, 'Split space')
        expect(out.keyboard.layouts?.[0].name).toBe('Split space')
    })

    it('setKeyVariant tags a key; removeLayout drops it + clears the tag', () => {
        const { config, id } = addLayout(grid(1, 2))
        const tagged = setKeyVariant(config, 0, id)
        expect(tagged.keyboard.keys[0].variant).toBe(id)
        const removed = removeLayout(tagged, id)
        expect(removed.keyboard.layouts).toBeUndefined()
        expect(removed.keyboard.keys[0].variant).toBeUndefined()
    })
})
