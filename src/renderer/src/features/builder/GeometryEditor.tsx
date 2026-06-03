// Pattern check: no GoF pattern (-) — rejected — controlled SVG geometry editor
// (select + drag handles + numeric inspector) over the pure key/encoder helpers;
// UI event plumbing, no abstraction.
//
// Free-form per-key + encoder editing for the builder: an SVG layout where a key
// or encoder is clicked to select and DRAGGED to move; the selected key also gets
// resize (bottom-right) and rotate (top) handles. A numeric inspector edits the
// same values precisely. Add/Delete change the key or encoder set. Fully
// controlled: holds only the selection + a drag session; every config change is
// lifted via onChange. Drags derive from a start-snapshot + cumulative pointer
// delta (independent of intermediate state) and snap to 0.25u / 5°.
import { useRef, useState } from 'react'
import { Plus, Trash2, Disc3 } from 'lucide-react'
import type {
    CanonEncoderSlot,
    CanonGeometry,
    ConfigKeymap,
} from '@firmware/config'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import {
    addEncoder,
    addKey,
    removeEncoder,
    removeKey,
    snap,
    updateEncoder,
    updateKey,
} from './geometryEditor'

const UNIT = 40 // px per key unit in the preview
const PAD = 8
const STEP = 0.25 // position / size snap (key units)
const ROT_STEP = 5 // rotation snap (degrees)
const HANDLE = 6 // drag-handle radius (svg units)
const ENC_R = 0.34 // encoder glyph radius (key units)

interface GeometryEditorProps {
    value: ConfigKeymap
    onChange: (next: ConfigKeymap) => void
}

type Selection =
    | { kind: 'key'; index: number }
    | { kind: 'encoder'; index: number }

type DragKind = 'move' | 'resize' | 'rotate' | 'encoder'

interface DragSession {
    kind: DragKind
    sel: Selection
    startClientX: number
    startClientY: number
    unitsPerPx: number // key units per client pixel
    startGeom: CanonGeometry | null
    startSlot: CanonEncoderSlot | null
    pivotClientX: number // for rotate
    pivotClientY: number
    startAngle: number // for rotate (degrees)
}

const KEY_FIELDS: { key: keyof CanonGeometry; label: string }[] = [
    { key: 'x', label: 'X' },
    { key: 'y', label: 'Y' },
    { key: 'w', label: 'W' },
    { key: 'h', label: 'H' },
    { key: 'r', label: 'Rotate°' },
    { key: 'rx', label: 'Pivot X' },
    { key: 'ry', label: 'Pivot Y' },
]

export function GeometryEditor({
    value,
    onChange,
}: GeometryEditorProps): JSX.Element {
    const keys = value.keyboard.keys
    const encoders = value.keyboard.encoders ?? []

    const [sel, setSel] = useState<Selection>({ kind: 'key', index: 0 })
    // Clamp the selection if the underlying list shrank (delete) so we never
    // index past the end.
    const selIndex =
        sel.kind === 'key'
            ? Math.min(sel.index, keys.length - 1)
            : Math.min(sel.index, encoders.length - 1)
    const selKind: Selection['kind'] =
        sel.kind === 'encoder' && encoders.length === 0 ? 'key' : sel.kind
    const selectedKey = selKind === 'key' ? keys[selIndex] : undefined
    const selectedEnc = selKind === 'encoder' ? encoders[selIndex] : undefined

    // Per-field raw input strings so a controlled numeric value doesn't snap to
    // the parsed Number mid-type and eat the decimal point ("0.5" → "5"). Reset
    // when the selection changes (React's store-prev-value-in-render pattern).
    const [drafts, setDrafts] = useState<Record<string, string>>({})
    const selToken = `${selKind}:${selIndex}`
    const [lastToken, setLastToken] = useState(selToken)
    if (selToken !== lastToken) {
        setLastToken(selToken)
        setDrafts({})
    }

    const svgRef = useRef<SVGSVGElement>(null)
    const dragRef = useRef<DragSession | null>(null)

    const maxX = Math.max(
        1,
        ...keys.map((k) => k.x + k.w),
        ...encoders.map((e) => e.x + ENC_R * 2),
    )
    const maxY = Math.max(
        1,
        ...keys.map((k) => k.y + k.h),
        ...encoders.map((e) => e.y + ENC_R * 2),
    )
    const width = maxX * UNIT + PAD * 2
    const height = maxY * UNIT + PAD * 2

    const setKeyField = (field: keyof CanonGeometry, raw: string): void => {
        setDrafts((d) => ({ ...d, [field]: raw }))
        const n = Number(raw)
        if (selKind === 'key' && raw !== '' && !Number.isNaN(n)) {
            onChange(updateKey(value, selIndex, { [field]: n }))
        }
    }

    const setEncField = (field: 'x' | 'y', raw: string): void => {
        setDrafts((d) => ({ ...d, [field]: raw }))
        const n = Number(raw)
        if (selKind === 'encoder' && raw !== '' && !Number.isNaN(n)) {
            onChange(updateEncoder(value, selIndex, { [field]: n }))
        }
    }

    // --- pointer drag --------------------------------------------------------

    const onDragMove = (e: PointerEvent): void => {
        const d = dragRef.current
        if (!d) return
        const dxUnits = (e.clientX - d.startClientX) * d.unitsPerPx
        const dyUnits = (e.clientY - d.startClientY) * d.unitsPerPx

        if (d.kind === 'move' && d.startGeom) {
            onChange(
                updateKey(value, d.sel.index, {
                    x: snap(d.startGeom.x + dxUnits, STEP),
                    y: snap(d.startGeom.y + dyUnits, STEP),
                }),
            )
        } else if (d.kind === 'resize' && d.startGeom) {
            onChange(
                updateKey(value, d.sel.index, {
                    w: Math.max(STEP, snap(d.startGeom.w + dxUnits, STEP)),
                    h: Math.max(STEP, snap(d.startGeom.h + dyUnits, STEP)),
                }),
            )
        } else if (d.kind === 'rotate' && d.startGeom) {
            const angle =
                (Math.atan2(
                    e.clientY - d.pivotClientY,
                    e.clientX - d.pivotClientX,
                ) *
                    180) /
                Math.PI
            onChange(
                updateKey(value, d.sel.index, {
                    r: snap(d.startGeom.r + (angle - d.startAngle), ROT_STEP),
                }),
            )
        } else if (d.kind === 'encoder' && d.startSlot) {
            onChange(
                updateEncoder(value, d.sel.index, {
                    x: snap(d.startSlot.x + dxUnits, STEP),
                    y: snap(d.startSlot.y + dyUnits, STEP),
                }),
            )
        }
    }

    const endDrag = (): void => {
        dragRef.current = null
        window.removeEventListener('pointermove', onDragMove)
        window.removeEventListener('pointerup', endDrag)
    }

    const beginDrag = (
        e: React.PointerEvent,
        kind: DragKind,
        sel: Selection,
    ): void => {
        e.preventDefault()
        e.stopPropagation()
        const svg = svgRef.current
        if (!svg) return
        const rect = svg.getBoundingClientRect()
        // px-per-svg-unit (the SVG is scaled by max-w-full), then key units/px.
        const scale = rect.width / width
        const unitsPerPx = scale > 0 ? 1 / (scale * UNIT) : 1 / UNIT

        let pivotClientX = 0
        let pivotClientY = 0
        let startAngle = 0
        const startGeom = sel.kind === 'key' ? { ...keys[sel.index] } : null
        if (kind === 'rotate' && startGeom) {
            const pivotUnitX = startGeom.rx ?? startGeom.x
            const pivotUnitY = startGeom.ry ?? startGeom.y
            pivotClientX = rect.left + (pivotUnitX * UNIT + PAD) * scale
            pivotClientY = rect.top + (pivotUnitY * UNIT + PAD) * scale
            startAngle =
                (Math.atan2(
                    e.clientY - pivotClientY,
                    e.clientX - pivotClientX,
                ) *
                    180) /
                Math.PI
        }

        dragRef.current = {
            kind,
            sel,
            startClientX: e.clientX,
            startClientY: e.clientY,
            unitsPerPx,
            startGeom,
            startSlot:
                sel.kind === 'encoder' ? { ...encoders[sel.index] } : null,
            pivotClientX,
            pivotClientY,
            startAngle,
        }
        setSel(sel)
        window.addEventListener('pointermove', onDragMove)
        window.addEventListener('pointerup', endDrag)
    }

    // --- render --------------------------------------------------------------

    return (
        <div className="space-y-4">
            <div className="overflow-auto rounded-md border bg-muted/30 p-2">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${width} ${height}`}
                    width={width}
                    height={height}
                    className="max-w-full touch-none select-none"
                    role="img"
                    aria-label="Key layout"
                >
                    {keys.map((k, i) => {
                        const x = k.x * UNIT + PAD
                        const y = k.y * UNIT + PAD
                        const pivotX = (k.rx ?? k.x) * UNIT + PAD
                        const pivotY = (k.ry ?? k.y) * UNIT + PAD
                        const isSel = selKind === 'key' && i === selIndex
                        const w = k.w * UNIT
                        const h = k.h * UNIT
                        return (
                            <g
                                key={i}
                                transform={
                                    k.r
                                        ? `rotate(${k.r} ${pivotX} ${pivotY})`
                                        : undefined
                                }
                            >
                                <rect
                                    x={x + 1}
                                    y={y + 1}
                                    width={w - 2}
                                    height={h - 2}
                                    rx={4}
                                    className={
                                        isSel
                                            ? 'cursor-move fill-primary/30 stroke-primary'
                                            : 'cursor-pointer fill-primary/10 stroke-border hover:fill-primary/20'
                                    }
                                    strokeWidth={isSel ? 2 : 1}
                                    onPointerDown={(e) =>
                                        beginDrag(e, 'move', {
                                            kind: 'key',
                                            index: i,
                                        })
                                    }
                                />
                                <text
                                    x={x + w / 2}
                                    y={y + h / 2}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    className="pointer-events-none fill-muted-foreground text-[10px]"
                                >
                                    {i}
                                </text>
                                {isSel && (
                                    <>
                                        {/* resize handle (bottom-right) */}
                                        <rect
                                            x={x + w - HANDLE}
                                            y={y + h - HANDLE}
                                            width={HANDLE * 2}
                                            height={HANDLE * 2}
                                            rx={2}
                                            className="cursor-nwse-resize fill-primary stroke-background"
                                            strokeWidth={1.5}
                                            onPointerDown={(e) =>
                                                beginDrag(e, 'resize', {
                                                    kind: 'key',
                                                    index: i,
                                                })
                                            }
                                        />
                                        {/* rotate handle (above top edge) */}
                                        <circle
                                            cx={x + w / 2}
                                            cy={y - HANDLE * 2}
                                            r={HANDLE}
                                            className="cursor-grab fill-background stroke-primary"
                                            strokeWidth={1.5}
                                            onPointerDown={(e) =>
                                                beginDrag(e, 'rotate', {
                                                    kind: 'key',
                                                    index: i,
                                                })
                                            }
                                        />
                                        <line
                                            x1={x + w / 2}
                                            y1={y}
                                            x2={x + w / 2}
                                            y2={y - HANDLE}
                                            className="pointer-events-none stroke-primary"
                                            strokeWidth={1}
                                        />
                                    </>
                                )}
                            </g>
                        )
                    })}

                    {encoders.map((enc, i) => {
                        const cx = enc.x * UNIT + PAD + ENC_R * UNIT
                        const cy = enc.y * UNIT + PAD + ENC_R * UNIT
                        const isSel = selKind === 'encoder' && i === selIndex
                        return (
                            <g key={`enc-${i}`}>
                                <circle
                                    cx={cx}
                                    cy={cy}
                                    r={ENC_R * UNIT}
                                    className={
                                        isSel
                                            ? 'cursor-move fill-amber-500/30 stroke-amber-500'
                                            : 'cursor-pointer fill-amber-500/10 stroke-amber-500/60 hover:fill-amber-500/20'
                                    }
                                    strokeWidth={isSel ? 2 : 1}
                                    onPointerDown={(e) =>
                                        beginDrag(e, 'encoder', {
                                            kind: 'encoder',
                                            index: i,
                                        })
                                    }
                                />
                                <text
                                    x={cx}
                                    y={cy}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    className="pointer-events-none fill-amber-600 text-[9px] font-semibold"
                                >
                                    ↻{i}
                                </text>
                            </g>
                        )
                    })}
                </svg>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                    {keys.length} keys
                    {encoders.length > 0 && ` · ${encoders.length} enc`} ·
                    editing {selKind}{' '}
                    <span className="font-mono">{selIndex}</span>
                </p>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            onChange(addKey(value))
                            setSel({ kind: 'key', index: keys.length })
                        }}
                        className="flex items-center gap-1.5"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add key
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            onChange(addEncoder(value))
                            setSel({ kind: 'encoder', index: encoders.length })
                        }}
                        className="flex items-center gap-1.5"
                    >
                        <Disc3 className="h-3.5 w-3.5" />
                        Add encoder
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={
                            selKind === 'key'
                                ? keys.length <= 1
                                : encoders.length === 0
                        }
                        onClick={() => {
                            if (selKind === 'key') {
                                onChange(removeKey(value, selIndex))
                                setSel({
                                    kind: 'key',
                                    index: Math.max(0, selIndex - 1),
                                })
                            } else {
                                onChange(removeEncoder(value, selIndex))
                                setSel({ kind: 'key', index: 0 })
                            }
                        }}
                        className="flex items-center gap-1.5"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                    </Button>
                </div>
            </div>

            {selectedKey && (
                <div className="grid grid-cols-4 gap-3">
                    {KEY_FIELDS.map((f) => (
                        <div key={f.key} className="space-y-1.5">
                            <Label htmlFor={`geo-${f.key}`} className="text-xs">
                                {f.label}
                            </Label>
                            <Input
                                id={`geo-${f.key}`}
                                inputMode="decimal"
                                value={
                                    drafts[f.key] ??
                                    String(selectedKey[f.key] ?? '')
                                }
                                onChange={(e) =>
                                    setKeyField(f.key, e.target.value)
                                }
                            />
                        </div>
                    ))}
                </div>
            )}

            {selectedEnc && (
                <div className="grid grid-cols-4 gap-3">
                    {(['x', 'y'] as const).map((f) => (
                        <div key={f} className="space-y-1.5">
                            <Label htmlFor={`enc-${f}`} className="text-xs">
                                {f.toUpperCase()}
                            </Label>
                            <Input
                                id={`enc-${f}`}
                                inputMode="decimal"
                                value={
                                    drafts[f] ?? String(selectedEnc[f] ?? '')
                                }
                                onChange={(e) => setEncField(f, e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
