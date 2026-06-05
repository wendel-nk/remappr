// Pattern check: no GoF pattern (-) — rejected — pure immutable helpers that read/
// write the builder's friendly GPIO pin labels (keyboard.pins) and grow the
// electrical transform when a row/column is added; data transforms, no abstraction.
//
// Friendly row/column pin labels for the matrix-wiring overlay. These live in
// `keyboard.pins` (builder metadata) — deliberately NOT in `hardware.kscan`,
// whose GpioSpec strings are real devicetree wiring; editing a label here must
// never break ZMK export. Labels are index-aligned to the electrical transform's
// rows/columns; missing entries fall back to a generated default so a board with
// no explicit pins still shows GP0, GP1, … in the overlay and inspector.

import type { ConfigKeymap, ConfigPins } from '@firmware/config'
import { ensureTransform } from './builderInspectorOps'

/** Default label for row `i` / column `j`. Columns are numbered after the rows
 *  so a freshly-auto-wired board gets non-colliding GP labels (rows GP0…, then
 *  cols continue), mirroring the prototype's seeded pin lists. */
export const defaultRowPin = (i: number): string => `GP${i}`
export const defaultColPin = (rows: number, j: number): string =>
    `GP${rows + j}`

/** Friendly labels for every row, length === transform.rows (defaults filled). */
export function rowPins(config: ConfigKeymap): string[] {
    const t = ensureTransform(config)
    const stored = config.keyboard.pins?.rows ?? []
    return Array.from(
        { length: t.rows },
        (_, i) => stored[i] || defaultRowPin(i),
    )
}

/** Friendly labels for every column, length === transform.columns. */
export function colPins(config: ConfigKeymap): string[] {
    const t = ensureTransform(config)
    const stored = config.keyboard.pins?.cols ?? []
    return Array.from(
        { length: t.columns },
        (_, j) => stored[j] || defaultColPin(t.rows, j),
    )
}

/** Label for one row / column index. */
export const rowPin = (config: ConfigKeymap, i: number): string =>
    rowPins(config)[i] ?? defaultRowPin(i)
export const colPin = (config: ConfigKeymap, j: number): string =>
    colPins(config)[j] ?? defaultColPin(ensureTransform(config).rows, j)

/** Write back a full pins object (and commit the transform so rows/cols counts
 *  the labels are aligned to are stable, not re-derived on the next edit). */
function withPins(
    config: ConfigKeymap,
    pins: ConfigPins,
    rows: number,
    columns: number,
): ConfigKeymap {
    const t = ensureTransform(config)
    return {
        ...config,
        keyboard: {
            ...config.keyboard,
            pins,
            hardware: {
                ...config.keyboard.hardware,
                transform: { rows, columns, map: t.map },
            },
        },
    }
}

/** Rename one row's pin label (empty → default). */
export function setRowPin(
    config: ConfigKeymap,
    i: number,
    label: string,
): ConfigKeymap {
    const t = ensureTransform(config)
    const rows = rowPins(config)
    rows[i] = label.trim() || defaultRowPin(i)
    return withPins(config, { rows, cols: colPins(config) }, t.rows, t.columns)
}

/** Rename one column's pin label (empty → default). */
export function setColPin(
    config: ConfigKeymap,
    j: number,
    label: string,
): ConfigKeymap {
    const t = ensureTransform(config)
    const cols = colPins(config)
    cols[j] = label.trim() || defaultColPin(t.rows, j)
    return withPins(config, { rows: rowPins(config), cols }, t.rows, t.columns)
}

/** Parse a free-text pin list ("GP4 GP5, GP6") into tokens. */
const splitPins = (text: string): string[] =>
    text.split(/[\s,]+/).filter(Boolean)

/** Replace every row label from a free-text list (one token per matrix row;
 *  extra tokens ignored, missing positions fall back to the default label).
 *  Matches the prototype's single "row pins" field without changing matrix dims. */
export function setRowPinsText(
    config: ConfigKeymap,
    text: string,
): ConfigKeymap {
    const t = ensureTransform(config)
    const tokens = splitPins(text)
    const rows = Array.from(
        { length: t.rows },
        (_, i) => tokens[i] || defaultRowPin(i),
    )
    return withPins(config, { rows, cols: colPins(config) }, t.rows, t.columns)
}

/** Replace every column label from a free-text list (see setRowPinsText). */
export function setColPinsText(
    config: ConfigKeymap,
    text: string,
): ConfigKeymap {
    const t = ensureTransform(config)
    const tokens = splitPins(text)
    const cols = Array.from(
        { length: t.columns },
        (_, j) => tokens[j] || defaultColPin(t.rows, j),
    )
    return withPins(config, { rows: rowPins(config), cols }, t.rows, t.columns)
}

/** Append an unused matrix row (grows the transform; keys are assigned to it
 *  later via the inspector). Returns the new row index too. */
export function addRow(config: ConfigKeymap): {
    config: ConfigKeymap
    index: number
} {
    const t = ensureTransform(config)
    const rows = rowPins(config)
    rows.push(defaultRowPin(rows.length))
    return {
        config: withPins(
            config,
            { rows, cols: colPins(config) },
            t.rows + 1,
            t.columns,
        ),
        index: t.rows,
    }
}

/** Append an unused matrix column (grows the transform). */
export function addCol(config: ConfigKeymap): {
    config: ConfigKeymap
    index: number
} {
    const t = ensureTransform(config)
    const cols = colPins(config)
    cols.push(defaultColPin(t.rows, cols.length))
    return {
        config: withPins(
            config,
            { rows: rowPins(config), cols },
            t.rows,
            t.columns + 1,
        ),
        index: t.columns,
    }
}
