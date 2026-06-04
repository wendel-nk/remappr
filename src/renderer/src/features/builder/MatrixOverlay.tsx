// Pattern check: no GoF pattern (-) — rejected — presentational SVG overlay that
// draws each matrix row/column run + a row/col index label from the electrical
// transform; pure render ported from app/builder/BuilderCanvas.jsx, no abstraction.
//
// The matrix-wiring overlay shown on the canvas when the toolbar Scan toggle is on.
// It reads the board's [row,col]-per-key transform (index-aligned to keyboard.keys)
// and draws, for each row and column, a dashed run connecting the caps wired to it,
// plus a coloured index pin at the run's anchor. Read-only for now (per-key wiring
// is edited in the inspector); editable GPIO pins land with the kscan editor.
import type { CanonGeometry, CanonMatrixTransform } from '@firmware/config'

const ROW_C = 'oklch(0.72 0.17 35)'
const COL_C = 'oklch(0.72 0.14 250)'

interface Run {
    key: string
    id: number
    anchor: { x: number; y: number }
    d: string
}

function buildRuns(
    keys: CanonGeometry[],
    pick: (rc: [number, number]) => number,
    map: [number, number][],
    oneU: number,
    horizontal: boolean,
): Run[] {
    const ctr = (k: CanonGeometry): { x: number; y: number } => ({
        x: (k.x + k.w / 2) * oneU,
        y: (k.y + k.h / 2) * oneU,
    })
    const groups = new Map<number, CanonGeometry[]>()
    keys.forEach((k, i) => {
        const rc = map[i]
        if (!rc) return
        const id = pick(rc)
        const list = groups.get(id) ?? []
        list.push(k)
        groups.set(id, list)
    })
    const GAP = oneU * 1.05
    return [...groups.entries()].map(([id, arr]) => {
        const sorted = [...arr].sort((a, b) =>
            horizontal ? a.x - b.x : a.y - b.y,
        )
        const c0 = ctr(sorted[0])
        const anchor = horizontal
            ? { x: c0.x - GAP, y: c0.y }
            : { x: c0.x, y: c0.y - GAP }
        const line = sorted
            .map((k) => {
                const c = ctr(k)
                return `L${c.x.toFixed(1)} ${c.y.toFixed(1)}`
            })
            .join(' ')
        return {
            key: (horizontal ? 'r' : 'c') + id,
            id,
            anchor,
            d: `M${anchor.x.toFixed(1)} ${anchor.y.toFixed(1)} ${line}`,
        }
    })
}

export function MatrixOverlay({
    keys,
    transform,
    oneU,
    innerW,
    innerH,
}: {
    keys: CanonGeometry[]
    transform: CanonMatrixTransform
    oneU: number
    innerW: number
    innerH: number
}): JSX.Element {
    const map = transform.map
    const rows = buildRuns(keys, (rc) => rc[0], map, oneU, true)
    const cols = buildRuns(keys, (rc) => rc[1], map, oneU, false)
    const ctr = (k: CanonGeometry): { x: number; y: number } => ({
        x: (k.x + k.w / 2) * oneU,
        y: (k.y + k.h / 2) * oneU,
    })
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
                    const c = ctr(k)
                    return (
                        <circle
                            key={i}
                            cx={c.x}
                            cy={c.y}
                            r={3}
                            fill={ROW_C}
                            stroke="var(--card)"
                            strokeWidth={1}
                        />
                    )
                })}
            </svg>
            {rows.map((r) => (
                <PinLabel
                    key={r.key}
                    x={r.anchor.x - oneU * 0.36}
                    y={r.anchor.y}
                    color={ROW_C}
                    label={`R${r.id}`}
                />
            ))}
            {cols.map((c) => (
                <PinLabel
                    key={c.key}
                    x={c.anchor.x}
                    y={c.anchor.y - oneU * 0.28}
                    color={COL_C}
                    label={`C${c.id}`}
                />
            ))}
        </>
    )
}

/** A small coloured row/column index chip at a run anchor. */
function PinLabel({
    x,
    y,
    color,
    label,
}: {
    x: number
    y: number
    color: string
    label: string
}): JSX.Element {
    return (
        <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-md border bg-card px-1.5 py-0.5 font-mono text-[11px] font-bold"
            style={{ left: x, top: y, borderColor: color, color, zIndex: 28 }}
        >
            {label}
        </span>
    )
}
