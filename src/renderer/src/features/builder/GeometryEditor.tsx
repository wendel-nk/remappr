// Pattern check: no GoF pattern (-) — rejected — controlled SVG geometry editor
// (select + numeric inspector) over the pure key-edit helpers; UI plumbing, no
// abstraction.
//
// Free-form per-key editing for the builder: an SVG layout where a key is clicked
// to select, a numeric inspector edits its x/y/w/h/rotation, and Add/Delete change
// the key set. Numeric (not pixel-drag) — arbitrary staggered/rotated layouts are
// fully expressible; drag handles are a later refinement. Fully controlled: holds
// only the selection; every config change is lifted via onChange.
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { CanonGeometry, ConfigKeymap } from '@firmware/config'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { addKey, removeKey, updateKey } from './geometryEditor'

const UNIT = 40 // px per key unit in the preview
const PAD = 8

interface GeometryEditorProps {
    value: ConfigKeymap
    onChange: (next: ConfigKeymap) => void
}

const NUM_FIELDS: { key: keyof CanonGeometry; label: string }[] = [
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
    const [selected, setSelected] = useState(0)
    const sel = Math.min(selected, keys.length - 1)
    const key = keys[sel]

    const width = Math.max(...keys.map((k) => k.x + k.w)) * UNIT + PAD * 2
    const height = Math.max(...keys.map((k) => k.y + k.h)) * UNIT + PAD * 2

    const setField = (field: keyof CanonGeometry, raw: string): void => {
        const n = Number(raw)
        if (raw !== '' && !Number.isNaN(n)) {
            onChange(updateKey(value, sel, { [field]: n }))
        }
    }

    return (
        <div className="space-y-4">
            <div className="overflow-auto rounded-md border bg-muted/30 p-2">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    width={width}
                    height={height}
                    className="max-w-full"
                    role="img"
                    aria-label="Key layout"
                >
                    {keys.map((k, i) => {
                        const x = k.x * UNIT + PAD
                        const y = k.y * UNIT + PAD
                        const pivotX = (k.rx ?? k.x) * UNIT + PAD
                        const pivotY = (k.ry ?? k.y) * UNIT + PAD
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
                                    width={k.w * UNIT - 2}
                                    height={k.h * UNIT - 2}
                                    rx={4}
                                    className={
                                        i === sel
                                            ? 'cursor-pointer fill-primary/30 stroke-primary'
                                            : 'cursor-pointer fill-primary/10 stroke-border hover:fill-primary/20'
                                    }
                                    strokeWidth={i === sel ? 2 : 1}
                                    onClick={() => setSelected(i)}
                                />
                                <text
                                    x={x + (k.w * UNIT) / 2}
                                    y={y + (k.h * UNIT) / 2}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    className="pointer-events-none fill-muted-foreground text-[10px]"
                                >
                                    {i}
                                </text>
                            </g>
                        )
                    })}
                </svg>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                    {keys.length} keys · editing key{' '}
                    <span className="font-mono">{sel}</span>
                </p>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            onChange(addKey(value))
                            setSelected(keys.length) // select the appended key
                        }}
                        className="flex items-center gap-1.5"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add key
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={keys.length <= 1}
                        onClick={() => {
                            onChange(removeKey(value, sel))
                            setSelected(Math.max(0, sel - 1))
                        }}
                        className="flex items-center gap-1.5"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                    </Button>
                </div>
            </div>

            {key && (
                <div className="grid grid-cols-4 gap-3">
                    {NUM_FIELDS.map((f) => (
                        <div key={f.key} className="space-y-1.5">
                            <Label htmlFor={`geo-${f.key}`} className="text-xs">
                                {f.label}
                            </Label>
                            <Input
                                id={`geo-${f.key}`}
                                inputMode="decimal"
                                value={key[f.key] ?? ''}
                                onChange={(e) =>
                                    setField(f.key, e.target.value)
                                }
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
