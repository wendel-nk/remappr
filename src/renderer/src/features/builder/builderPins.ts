// Pattern check: no GoF pattern (-) — rejected — pure immutable helpers that read/
// write the builder's friendly GPIO pin labels (keyboard.pins); data transforms,
// no abstraction.
//
// Friendly row/column pin labels for the matrix-wiring overlay. These live in
// `keyboard.pins` (builder metadata) — deliberately NOT in `hardware.kscan`,
// whose GpioSpec strings are real devicetree wiring; editing a label here must
// never break ZMK export. Labels are index-aligned to the matrix dimensions
// (`matrixDims`, derived from `keys[].matrix` + the board descriptor); missing
// entries fall back to a generated default so a board with no explicit pins still
// shows GP0, GP1, … in the overlay and inspector. A stored pin list also acts as
// a dims floor (see `matrixDims`), so "+ add row/column" simply appends a label.

import { matrixDims } from '@firmware/config'
import type { ConfigKeymap, ConfigPins } from '@firmware/config'

/** Default label for row `i` / column `j`. Columns are numbered after the rows
 *  so a freshly-auto-wired board gets non-colliding GP labels (rows GP0…, then
 *  cols continue), mirroring the prototype's seeded pin lists. */
export const defaultRowPin = (i: number): string => `GP${i}`
export const defaultColPin = (rows: number, j: number): string =>
    `GP${rows + j}`

/** Friendly labels for every row, length === matrix rows (defaults filled). */
export function rowPins(config: ConfigKeymap): string[] {
    const { rows } = matrixDims(config)
    const stored = config.keyboard.pins?.rows ?? []
    return Array.from({ length: rows }, (_, i) => stored[i] || defaultRowPin(i))
}

/** Friendly labels for every column, length === matrix cols (defaults filled). */
export function colPins(config: ConfigKeymap): string[] {
    const { rows, cols } = matrixDims(config)
    const stored = config.keyboard.pins?.cols ?? []
    return Array.from(
        { length: cols },
        (_, j) => stored[j] || defaultColPin(rows, j),
    )
}

/** Label for one row / column index. */
export const rowPin = (config: ConfigKeymap, i: number): string =>
    rowPins(config)[i] ?? defaultRowPin(i)
export const colPin = (config: ConfigKeymap, j: number): string =>
    colPins(config)[j] ?? defaultColPin(matrixDims(config).rows, j)

/** Write back a full pins object (builder metadata only; the stored lengths act
 *  as a matrix-dims floor so the row/column counts stay stable). */
function withPins(config: ConfigKeymap, pins: ConfigPins): ConfigKeymap {
    return { ...config, keyboard: { ...config.keyboard, pins } }
}

/** Rename one row's pin label (empty → default). */
export function setRowPin(
    config: ConfigKeymap,
    i: number,
    label: string,
): ConfigKeymap {
    const rows = rowPins(config)
    rows[i] = label.trim() || defaultRowPin(i)
    return withPins(config, { rows, cols: colPins(config) })
}

/** Rename one column's pin label (empty → default). */
export function setColPin(
    config: ConfigKeymap,
    j: number,
    label: string,
): ConfigKeymap {
    const cols = colPins(config)
    cols[j] = label.trim() || defaultColPin(matrixDims(config).rows, j)
    return withPins(config, { rows: rowPins(config), cols })
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
    const { rows: n } = matrixDims(config)
    const tokens = splitPins(text)
    const rows = Array.from(
        { length: n },
        (_, i) => tokens[i] || defaultRowPin(i),
    )
    return withPins(config, { rows, cols: colPins(config) })
}

/** Replace every column label from a free-text list (see setRowPinsText). */
export function setColPinsText(
    config: ConfigKeymap,
    text: string,
): ConfigKeymap {
    const { rows, cols: n } = matrixDims(config)
    const tokens = splitPins(text)
    const cols = Array.from(
        { length: n },
        (_, j) => tokens[j] || defaultColPin(rows, j),
    )
    return withPins(config, { rows: rowPins(config), cols })
}

/** Append an unused matrix row (the new pin label grows the dims floor; keys are
 *  wired to it later via the inspector). Returns the new row index too. */
export function addRow(config: ConfigKeymap): {
    config: ConfigKeymap
    index: number
} {
    const { rows } = matrixDims(config)
    const labels = rowPins(config)
    labels.push(defaultRowPin(rows))
    return {
        config: withPins(config, { rows: labels, cols: colPins(config) }),
        index: rows,
    }
}

/** Append an unused matrix column (the new pin label grows the dims floor). */
export function addCol(config: ConfigKeymap): {
    config: ConfigKeymap
    index: number
} {
    const { rows, cols } = matrixDims(config)
    const labels = colPins(config)
    labels.push(defaultColPin(rows, cols))
    return {
        config: withPins(config, { rows: rowPins(config), cols: labels }),
        index: cols,
    }
}
