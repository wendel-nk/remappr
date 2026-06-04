// Pattern check: no GoF pattern (-) — rejected — presentational right inspector
// (single-key geometry/rotation/matrix/binding/variant + multi-select bulk ops)
// bound to configStore/builderStore through builderInspectorOps; UI, no abstraction.
//
// The right inspector, ported from app/builder/BuilderPanels.jsx (Inspector). It
// edits the current selection: nothing → hint; one key → geometry, rotation,
// per-key matrix wiring, a layout-variant tag, and a quick binding for the active
// layer; many keys → bulk align/size/matrix/duplicate/delete. All mutations route
// through builderStore.commit so they join the undo history.
/* eslint-disable jsx-a11y/no-autofocus -- the inline binding-rename input autofocuses by design, matching the prototype + the layers panel. */
import { useState } from 'react'
import {
    AlignStartVertical,
    Copy,
    Pencil,
    RotateCcw,
    Ruler,
    Scan,
    Trash2,
    Wand2,
    X,
} from 'lucide-react'
import { toast } from 'sonner'
import useBuilderStore from '@/stores/builderStore'
import useConfigStore from '@/stores/configStore'
import type { CanonGeometry } from '@firmware/config'
import { duplicateKeys, removeKeys } from './geometryEditor'
import {
    applyAutoMatrix,
    bindingLabel,
    bulkGeometry,
    bulkNumberCols,
    bulkSetRow,
    ensureTransform,
    keyMatrix,
    parseBindingToken,
    patchKey,
    setBinding,
    setKeyMatrix,
    setKeyVariant,
} from './builderInspectorOps'

const WIDTH_PRESETS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.75, 6.25]

function MiniLabel({ children }: { children: React.ReactNode }): JSX.Element {
    return (
        <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            {children}
        </div>
    )
}

/** Numeric field that commits a number immediately (geometry is discrete). */
function NumInput({
    value,
    onChange,
    step = 0.25,
}: {
    value: number
    onChange: (v: number) => void
    step?: number
}): JSX.Element {
    return (
        <input
            type="number"
            step={step}
            value={value}
            onChange={(e) =>
                onChange(e.target.value === '' ? 0 : Number(e.target.value))
            }
            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 font-mono text-[12.5px] font-semibold text-foreground outline-none focus:border-primary"
        />
    )
}

function Field({
    label,
    children,
}: {
    label: string
    children: React.ReactNode
}): JSX.Element {
    return (
        <div>
            <div className="mb-1 text-[11px] text-muted-foreground">
                {label}
            </div>
            {children}
        </div>
    )
}

/** A bulk-action button (icon + label). */
function BulkBtn({
    icon,
    label,
    onClick,
    destructive,
}: {
    icon: React.ReactNode
    label: string
    onClick: () => void
    destructive?: boolean
}): JSX.Element {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-2.5 py-2 text-[12px] font-semibold transition-colors ${
                destructive
                    ? 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15'
                    : 'border-border bg-background text-foreground hover:border-primary'
            }`}
        >
            {icon} {label}
        </button>
    )
}

export function BuilderInspector(): JSX.Element {
    const config = useConfigStore((s) => s.config)
    const selection = useBuilderStore((s) => s.selection)
    const activeLayer = useBuilderStore((s) => s.activeLayer)
    const commit = useBuilderStore((s) => s.commit)
    const clearSelection = useBuilderStore((s) => s.clearSelection)
    const setSelection = useBuilderStore((s) => s.setSelection)
    const [rowVal, setRowVal] = useState(0)
    const [colStart, setColStart] = useState(0)

    const sel = [...selection].filter(
        (i) => config && i < config.keyboard.keys.length,
    )

    if (!config || sel.length === 0) {
        return (
            <div className="p-6 text-center">
                <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl border border-dashed border-border text-muted-foreground">
                    <Scan size={18} />
                </div>
                <div className="text-sm font-semibold">Nothing selected</div>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    Click a key to edit its size, position &amp; matrix. Drag on
                    empty space to marquee-select.
                </p>
            </div>
        )
    }

    /* ── multi-select ── */
    if (sel.length > 1) {
        const indices = new Set(sel)
        return (
            <div className="flex flex-col gap-4 p-4">
                <div>
                    <div className="text-[15px] font-bold">
                        {sel.length} keys selected
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                        Bulk actions apply to all.
                    </div>
                </div>
                <div>
                    <MiniLabel>Matrix wiring</MiniLabel>
                    <div className="mb-2 flex items-end gap-2">
                        <div className="flex-1">
                            <Field label="Set all to row">
                                <NumInput
                                    step={1}
                                    value={rowVal}
                                    onChange={setRowVal}
                                />
                            </Field>
                        </div>
                        <BulkBtn
                            icon={<Ruler size={14} />}
                            label="Apply"
                            onClick={() =>
                                commit(bulkSetRow(config, indices, rowVal))
                            }
                        />
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="flex-1">
                            <Field label="Number columns from">
                                <NumInput
                                    step={1}
                                    value={colStart}
                                    onChange={setColStart}
                                />
                            </Field>
                        </div>
                        <BulkBtn
                            icon={<Scan size={14} />}
                            label="By X"
                            onClick={() =>
                                commit(
                                    bulkNumberCols(config, indices, colStart),
                                )
                            }
                        />
                    </div>
                </div>
                <div>
                    <MiniLabel>Align &amp; size</MiniLabel>
                    <div className="grid grid-cols-2 gap-1.5">
                        <BulkBtn
                            icon={<AlignStartVertical size={14} />}
                            label="Left edges"
                            onClick={() =>
                                commit(bulkGeometry(config, indices, 'left'))
                            }
                        />
                        <BulkBtn
                            icon={
                                <AlignStartVertical
                                    size={14}
                                    className="rotate-90"
                                />
                            }
                            label="Top edges"
                            onClick={() =>
                                commit(bulkGeometry(config, indices, 'top'))
                            }
                        />
                        <BulkBtn
                            icon={<Ruler size={14} />}
                            label="Reset to 1U"
                            onClick={() =>
                                commit(bulkGeometry(config, indices, 'size1'))
                            }
                        />
                        <BulkBtn
                            icon={<Wand2 size={14} />}
                            label="Auto matrix"
                            onClick={() => commit(applyAutoMatrix(config))}
                        />
                        <BulkBtn
                            icon={<Copy size={14} />}
                            label="Duplicate"
                            onClick={() => {
                                const { config: next, newIndices } =
                                    duplicateKeys(config, indices)
                                commit(next)
                                setSelection(new Set(newIndices))
                            }}
                        />
                        <BulkBtn
                            icon={<Trash2 size={14} />}
                            label="Delete"
                            destructive
                            onClick={() => {
                                commit(removeKeys(config, indices))
                                clearSelection()
                            }}
                        />
                    </div>
                </div>
            </div>
        )
    }

    /* ── single key ── */
    const index = sel[0]
    const key = config.keyboard.keys[index]
    const setGeom = (patch: Partial<CanonGeometry>): void =>
        commit(patchKey(config, index, patch))
    const t = ensureTransform(config)
    const [row, col] = keyMatrix(config, index)
    const nRows = Math.max(t.rows, row + 1)
    const nCols = Math.max(t.columns, col + 1)
    const layouts = config.keyboard.layouts ?? []
    const binding = config.layers[activeLayer]?.bindings[index]
    const layerName = config.layers[activeLayer]?.name ?? 'layer'

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="text-[12px] font-semibold text-muted-foreground">
                Key #{index}
            </div>

            {/* binding (active layer) */}
            <div>
                <MiniLabel>Binding · {layerName}</MiniLabel>
                <BindingField
                    label={bindingLabel(binding)}
                    onCommit={(token) => {
                        const action = parseBindingToken(token)
                        if (!action) {
                            toast.error(`Unknown key "${token}"`)
                            return
                        }
                        commit(setBinding(config, activeLayer, index, action))
                    }}
                    onClear={() =>
                        commit(
                            setBinding(config, activeLayer, index, {
                                type: 'transparent',
                            }),
                        )
                    }
                />
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                    A keycode (A, Space), a combo (Ctrl+C), or “trans”. Layers,
                    tap-hold &amp; macros: use the editor.
                </p>
            </div>

            {/* variant */}
            {layouts.length > 0 && (
                <div>
                    <MiniLabel>Layout variant</MiniLabel>
                    <select
                        value={key.variant ?? ''}
                        onChange={(e) =>
                            commit(setKeyVariant(config, index, e.target.value))
                        }
                        className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-[13px] font-semibold text-foreground outline-none focus:border-primary"
                    >
                        <option value="">Common (all variants)</option>
                        {layouts.map((v) => (
                            <option key={v.id} value={v.id}>
                                {v.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* geometry */}
            <div>
                <MiniLabel>Geometry (U)</MiniLabel>
                <div className="grid grid-cols-2 gap-2">
                    <Field label="X">
                        <NumInput
                            value={key.x}
                            onChange={(v) => setGeom({ x: v })}
                        />
                    </Field>
                    <Field label="Y">
                        <NumInput
                            value={key.y}
                            onChange={(v) => setGeom({ y: v })}
                        />
                    </Field>
                    <Field label="Width">
                        <NumInput
                            value={key.w}
                            onChange={(v) => setGeom({ w: v })}
                        />
                    </Field>
                    <Field label="Height">
                        <NumInput
                            value={key.h}
                            onChange={(v) => setGeom({ h: v })}
                        />
                    </Field>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                    {WIDTH_PRESETS.map((w) => {
                        const on = Math.abs(key.w - w) < 0.001
                        return (
                            <button
                                key={w}
                                type="button"
                                onClick={() => setGeom({ w })}
                                className="rounded-md border px-2 py-1 font-mono text-[11px] font-semibold text-foreground"
                                style={{
                                    background: on
                                        ? 'color-mix(in oklch, var(--primary) 18%, var(--background))'
                                        : 'var(--background)',
                                    borderColor: on
                                        ? 'var(--primary)'
                                        : 'var(--border)',
                                }}
                            >
                                {w}u
                            </button>
                        )
                    })}
                    <button
                        type="button"
                        onClick={() => setGeom({ h: key.h === 2 ? 1 : 2 })}
                        className="rounded-md border px-2 py-1 font-mono text-[11px] font-semibold text-foreground"
                        style={{
                            background:
                                key.h === 2
                                    ? 'color-mix(in oklch, var(--primary) 18%, var(--background))'
                                    : 'var(--background)',
                            borderColor:
                                key.h === 2
                                    ? 'var(--primary)'
                                    : 'var(--border)',
                        }}
                    >
                        2u↕
                    </button>
                </div>
            </div>

            {/* rotation */}
            <div>
                <MiniLabel>Rotation</MiniLabel>
                <div className="grid grid-cols-2 gap-2">
                    <Field label="Angle °">
                        <NumInput
                            step={1}
                            value={key.r}
                            onChange={(v) => setGeom({ r: v })}
                        />
                    </Field>
                    <div className="flex items-end">
                        <button
                            type="button"
                            onClick={() =>
                                setGeom({ r: 0, rx: undefined, ry: undefined })
                            }
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary px-2 py-1.5 text-[12px] font-semibold text-foreground hover:border-primary"
                        >
                            <RotateCcw size={13} /> Reset
                        </button>
                    </div>
                </div>
                <div className="mt-2 flex items-center gap-1">
                    {[
                        ['−5°', -5],
                        ['+5°', 5],
                        ['−15°', -15],
                        ['+15°', 15],
                    ].map(([label, d]) => (
                        <button
                            key={label as string}
                            type="button"
                            onClick={() =>
                                setGeom({
                                    r:
                                        Math.round(
                                            ((key.r || 0) + (d as number)) * 10,
                                        ) / 10,
                                    rx: key.x + key.w / 2,
                                    ry: key.y + key.h / 2,
                                })
                            }
                            className="flex-1 rounded-md border border-border bg-secondary py-1.5 font-mono text-[11.5px] font-bold text-foreground hover:border-primary"
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {!!key.r && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        <Field label="Pivot X">
                            <NumInput
                                value={key.rx ?? 0}
                                onChange={(v) => setGeom({ rx: v })}
                            />
                        </Field>
                        <Field label="Pivot Y">
                            <NumInput
                                value={key.ry ?? 0}
                                onChange={(v) => setGeom({ ry: v })}
                            />
                        </Field>
                    </div>
                )}
            </div>

            {/* matrix wiring */}
            <div>
                <MiniLabel>Matrix wiring · row / column</MiniLabel>
                <div className="grid grid-cols-2 gap-2">
                    <Field label="Row">
                        <select
                            value={row}
                            onChange={(e) =>
                                commit(
                                    setKeyMatrix(
                                        config,
                                        index,
                                        Number(e.target.value),
                                        col,
                                    ),
                                )
                            }
                            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 font-mono text-[12.5px] font-semibold text-foreground outline-none focus:border-primary"
                        >
                            {Array.from({ length: nRows }).map((_, i) => (
                                <option key={i} value={i}>
                                    Row {i}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Column">
                        <select
                            value={col}
                            onChange={(e) =>
                                commit(
                                    setKeyMatrix(
                                        config,
                                        index,
                                        row,
                                        Number(e.target.value),
                                    ),
                                )
                            }
                            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 font-mono text-[12.5px] font-semibold text-foreground outline-none focus:border-primary"
                        >
                            {Array.from({ length: nCols }).map((_, i) => (
                                <option key={i} value={i}>
                                    Col {i}
                                </option>
                            ))}
                        </select>
                    </Field>
                </div>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-[12px]">
                    <Scan size={14} className="text-primary" />
                    <span className="text-muted-foreground">Wired to</span>
                    <span
                        className="font-mono text-[12.5px] font-bold"
                        style={{ color: 'oklch(0.72 0.17 35)' }}
                    >
                        R{row}
                    </span>
                    <span className="text-muted-foreground">×</span>
                    <span
                        className="font-mono text-[12.5px] font-bold"
                        style={{ color: 'oklch(0.72 0.14 250)' }}
                    >
                        C{col}
                    </span>
                </div>
            </div>
        </div>
    )
}

/** Quick binding row: shows the current binding, edits a token on click. */
function BindingField({
    label,
    onCommit,
    onClear,
}: {
    label: string
    onCommit: (token: string) => void
    onClear: () => void
}): JSX.Element {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState('')
    if (editing) {
        return (
            <input
                autoFocus
                value={draft}
                placeholder="A · Ctrl+C · trans"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                    setEditing(false)
                    if (draft.trim()) onCommit(draft)
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setEditing(false)
                }}
                className="w-full rounded-lg border border-primary bg-background px-2.5 py-2 font-mono text-[13px] font-semibold text-foreground outline-none"
            />
        )
    }
    return (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2">
            <span className="flex-1 truncate font-mono text-[14px] font-extrabold">
                {label}
            </span>
            <button
                type="button"
                aria-label="Edit binding"
                onClick={() => {
                    setDraft(label === '▽' ? '' : label)
                    setEditing(true)
                }}
                className="grid size-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
            >
                <Pencil size={13} />
            </button>
            <button
                type="button"
                aria-label="Clear binding"
                onClick={onClear}
                className="grid size-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
            >
                <X size={14} />
            </button>
        </div>
    )
}
