// pattern-check: skip — pure data: 36-key Corne-shaped physical layout coordinates
import type {PhysicalLayout, PhysicalLayoutKey} from '@firmware/types'

// Renderer (`resolveBindingLabels`, `PhysicalLayoutCanvas`) expects centi-unit
// coordinates (1u = 100). Match the ZMK convention so mock keys render at the
// same scale as real hardware.
const KEY_W = 100
const KEY_H = 100

// Corne: 3 rows x (5 cols + 1 thumb cluster) x 2 halves = 36 keys.
// Coordinates mirror the open-source Corne plate layout (no rotation).
// Inputs are in unit-keys (col, row); values stored on PhysicalLayoutKey are
// centi-units to match `resolveBindingLabels` / `PhysicalLayoutCanvas`.
function row (
    rowIndex: number,
    leftCol: number,
    count: number,
): PhysicalLayoutKey[] {
    const keys: PhysicalLayoutKey[] = []
    for ( let i = 0; i < count; i++ ) {
        keys.push( {
            x: (leftCol + i) * KEY_W,
            y: rowIndex * KEY_H,
            w: KEY_W,
            h: KEY_H,
        } )
    }
    return keys
}

function buildCorneLeft (): PhysicalLayoutKey[] {
    return [
        ...row( 0, 0, 5 ),
        ...row( 1, 0, 5 ),
        ...row( 2, 0, 5 ),
        // 3-key thumb cluster, inset
        {x: 2 * KEY_W, y: 3 * KEY_H, w: KEY_W, h: KEY_H},
        {x: 3 * KEY_W, y: 3 * KEY_H, w: KEY_W, h: KEY_H},
        {x: 4 * KEY_W, y: 3 * KEY_H, w: KEY_W, h: KEY_H},
    ]
}

function buildCorneRight (): PhysicalLayoutKey[] {
    const xOffsetCol = 7 // gap between halves (in unit-keys)
    return [
        ...row( 0, xOffsetCol, 5 ),
        ...row( 1, xOffsetCol, 5 ),
        ...row( 2, xOffsetCol, 5 ),
        {x: xOffsetCol * KEY_W, y: 3 * KEY_H, w: KEY_W, h: KEY_H},
        {x: (xOffsetCol + 1) * KEY_W, y: 3 * KEY_H, w: KEY_W, h: KEY_H},
        {x: (xOffsetCol + 2) * KEY_W, y: 3 * KEY_H, w: KEY_W, h: KEY_H},
    ]
}

export const MOCK_CORNE_LAYOUT: PhysicalLayout = {
    id: 0,
    name: 'Corne (Mock)',
    keys: [...buildCorneLeft(), ...buildCorneRight()],
}

export const MOCK_LAYOUTS: PhysicalLayout[] = [MOCK_CORNE_LAYOUT]
export const MOCK_KEY_COUNT = MOCK_CORNE_LAYOUT.keys.length // 36
