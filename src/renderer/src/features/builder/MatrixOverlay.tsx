// Pattern check: no GoF pattern (-) — rejected — presentational SVG overlay plus
// two small inline-edit UI bits (pin chip / add-pin button); local state only,
// no abstraction. Ported from app/builder/BuilderCanvas.jsx MatrixOverlay.
//
// The matrix-wiring overlay shown on the canvas when the toolbar Scan toggle is on.
// It reads the board's [row,col]-per-key transform (index-aligned to keyboard.keys)
// and draws, for each row and column, a dashed run connecting the caps wired to it,
// plus an EDITABLE GPIO pin chip at the run's anchor (click to rename) and "+"
// buttons to append an unused row / column. Drag-to-reposition the chips is not
// ported — pin chip offsets have no home in the canonical config.
// pattern-check: skip — moved buildRuns/keyCenter to builderMatrix, extracted pin chip; presentational only
import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import type { CanonGeometry, CanonMatrixTransform } from '@firmware/config'

import { buildRuns, keyCenter } from './builderMatrix'
import { MatrixEditorPin } from './MatrixEditorPin'

const ROW_C = 'oklch(0.72 0.17 35)'
const COL_C = 'oklch(0.72 0.14 250)'

export function MatrixOverlay({
    keys,
    transform,
    oneU,
    innerW,
    innerH,
    rowPins,
    colPins,
    onSetRowPin,
    onSetColPin,
    onAddRow,
    onAddCol,
}: {
    keys: CanonGeometry[]
    transform: CanonMatrixTransform
    oneU: number
    innerW: number
    innerH: number
    rowPins: string[]
    colPins: string[]
    onSetRowPin: (i: number, label: string) => void
    onSetColPin: (j: number, label: string) => void
    onAddRow: () => void
    onAddCol: () => void
}): JSX.Element {
    const map = transform.map
    // buildRuns is O(N log N) (sort per group + path-string build); memoize both so it
    // doesn't recompute on every canvas re-render (only when the wiring/size changes).
    const rows = useMemo(
        () => buildRuns(keys, (rc) => rc[0], map, oneU, true),
        [keys, map, oneU],
    )
    const cols = useMemo(
        () => buildRuns(keys, (rc) => rc[1], map, oneU, false),
        [keys, map, oneU],
    )
    // "+ add" buttons sit just past the last run on each axis.
    const lastRowY = rows.length
        ? Math.max(...rows.map((r) => r.anchor.y))
        : oneU * 0.5
    const firstRowX = rows.length ? rows[0].anchor.x : oneU * 0.5
    const lastColX = cols.length
        ? Math.max(...cols.map((c) => c.anchor.x))
        : oneU * 0.5
    const firstColY = cols.length ? cols[0].anchor.y : oneU * 0.5
    return (
        <>
            <svg
                width={innerW}
                height={innerH}
                className="pointer-events-none absolute inset-0"
                style={{ zIndex: 25, overflow: 'visible' }}
            >
                {cols.map((c) => (
                    <path
                        key={c.key}
                        d={c.d}
                        fill="none"
                        stroke={COL_C}
                        strokeWidth={2}
                        strokeOpacity={0.5}
                        strokeDasharray="2 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ))}
                {rows.map((r) => (
                    <path
                        key={r.key}
                        d={r.d}
                        fill="none"
                        stroke={ROW_C}
                        strokeWidth={2.5}
                        strokeOpacity={0.65}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ))}
                {keys.map((k, i) => {
                    const c = keyCenter(k, oneU)
                    const rc = map[i]
                    return (
                        <g key={i}>
                            <circle
                                cx={c.x}
                                cy={c.y}
                                r={3}
                                fill={ROW_C}
                                stroke="var(--card)"
                                strokeWidth={1}
                            />
                            {rc && (
                                <text
                                    x={c.x}
                                    y={c.y + oneU * 0.3}
                                    textAnchor="middle"
                                    fontSize={Math.max(8, oneU * 0.18)}
                                    fontWeight={700}
                                    fontFamily="ui-monospace, monospace"
                                    fill="var(--muted-foreground)"
                                    stroke="var(--card)"
                                    strokeWidth={2.5}
                                    paintOrder="stroke"
                                >
                                    {rc[0]},{rc[1]}
                                </text>
                            )}
                        </g>
                    )
                })}
            </svg>
            {rows.map((r) => (
                <MatrixEditorPin
                    key={r.key}
                    x={r.anchor.x - oneU * 0.36}
                    y={r.anchor.y}
                    color={ROW_C}
                    label={rowPins[r.id] ?? `GP${r.id}`}
                    onCommit={(v) => onSetRowPin(r.id, v)}
                />
            ))}
            {cols.map((c) => (
                <MatrixEditorPin
                    key={c.key}
                    x={c.anchor.x}
                    y={c.anchor.y - oneU * 0.28}
                    color={COL_C}
                    label={colPins[c.id] ?? `GP${c.id}`}
                    onCommit={(v) => onSetColPin(c.id, v)}
                />
            ))}
            <AddPinBtn
                x={firstRowX}
                y={lastRowY + oneU * 0.7}
                color={ROW_C}
                label="Add a matrix row"
                onClick={onAddRow}
            />
            <AddPinBtn
                x={lastColX + oneU * 0.7}
                y={firstColY}
                color={COL_C}
                label="Add a matrix column"
                onClick={onAddCol}
            />
        </>
    )
}

/** A dashed "+" button to append an unused matrix row / column. */
function AddPinBtn({
    x,
    y,
    color,
    label,
    onClick,
}: {
    x: number
    y: number
    color: string
    label: string
    onClick: () => void
}): JSX.Element {
    return (
        <button
            type="button"
            title={label}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClick}
            className="absolute grid size-[22px] -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-md border border-dashed bg-card"
            style={{ left: x, top: y, borderColor: color, color, zIndex: 28 }}
        >
            <Plus size={13} />
        </button>
    )
}
