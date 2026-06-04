// Pattern check: no GoF pattern (-) — rejected — presentational right inspector
// (single-key geometry/rotation/matrix/binding/variant + multi-select bulk ops)
// bound to configStore/builderStore through builderInspectorOps; UI, no abstraction.
//
// The right inspector, ported from app/builder/BuilderPanels.jsx (Inspector). It
// edits the current selection: nothing → hint; one key → geometry, rotation,
// per-key matrix wiring, a layout-variant tag, and a quick binding for the active
// layer; many keys → bulk align/size/matrix/duplicate/delete. All mutations route
// through builderStore.commit so they join the undo history.

import { useState } from 'react'
import {
    AlignStartVertical,
    Copy,
    Keyboard as KeyboardIcon,
    Pencil,
    RotateCcw,
    RotateCw,
    Ruler,
    Scan,
    SlidersHorizontal,
    Trash2,
    Wand2,
    X,
} from 'lucide-react'
import { KeyButton } from '@/features/keymap/keyboard/KeyButton'
import { Switch } from '@/ui/switch'
import useBuilderStore from '@/stores/builderStore'
import useConfigStore from '@/stores/configStore'
import type { CanonAction, CanonGeometry } from '@firmware/config'
import { duplicateKeys, removeKeys, snap as snapStep } from './geometryEditor'
import {
    applyAutoMatrix,
    bulkGeometry,
    bulkNumberCols,
    bulkSetRow,
    ensureTransform,
    isAutoAssign,
    keyMatrix,
    patchKey,
    removeTransform,
    setBinding,
    setEncoderBinding,
    setKeyMatrix,
    setKeyVariant,
    type EncoderSlot,
} from './builderInspectorOps'
import { builderCapProps, builderBindingCode } from './builderCapProps'
import { colPins, rowPins } from './builderPins'

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

// pattern-check: skip presentational helper components (element switcher + note), no logic
/** Element-type switcher (key / encoder / slider) at the top of the inspector. */
function ElementTabs({
    element,
    onSelect,
}: {
    element: 'key' | 'encoder' | 'slider'
    onSelect: (el: 'key' | 'encoder' | 'slider') => void
}): JSX.Element {
    const tabs: Array<['key' | 'encoder' | 'slider', string, React.ReactNode]> =
        [
            ['key', 'Key', <KeyboardIcon key="k" size={14} />],
            ['encoder', 'Encoder', <RotateCw key="e" size={14} />],
            ['slider', 'Slider', <SlidersHorizontal key="s" size={14} />],
        ]
    return (
        <div>
            <MiniLabel>Element</MiniLabel>
            <div className="grid grid-cols-3 gap-1.5">
                {tabs.map(([el, lbl, icon]) => {
                    const on = element === el
                    return (
                        <button
                            key={el}
                            type="button"
                            onClick={() => onSelect(el)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[12px] font-semibold text-foreground transition-colors"
                            style={{
                                background: on
                                    ? 'color-mix(in oklch, var(--primary) 16%, var(--background))'
                                    : 'var(--background)',
                                borderColor: on
                                    ? 'var(--primary)'
                                    : 'var(--border)',
                            }}
                        >
                            {icon} {lbl}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

/** A labelled informational note (used by the encoder / slider element panels). */
function ElementNote({
    label,
    text,
}: {
    label: string
    text: string
}): JSX.Element {
    return (
        <div>
            <MiniLabel>{label}</MiniLabel>
            <p className="rounded-lg border border-border bg-background px-2.5 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
                {text}
            </p>
        </div>
    )
}

/** A label + Switch row (matches the meta-form toggles). */
function ToggleRow({
    on,
    onToggle,
    label,
}: {
    on: boolean
    onToggle: (v: boolean) => void
    label: string
}): JSX.Element {
    return (
        <label className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-2.5 py-2">
            <span className="text-[12.5px] font-medium">{label}</span>
            <Switch checked={on} onCheckedChange={onToggle} />
        </label>
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

/** The three rotary slots of an encoder, in display order. */
const ENCODER_SLOTS: { slot: EncoderSlot; label: string }[] = [
    { slot: 'cw', label: 'Rotate ↻ (CW)' },
    { slot: 'ccw', label: 'Rotate ↺ (CCW)' },
    { slot: 'press', label: 'Press' },
]

// pattern-check: skip presentational cap-preview + edit/clear row, reuses capProps, no logic
/** One compact binding row: a cap preview + slot label + edit / clear. Shared by
 *  the encoder rotary slots (cw / ccw / press); opening edits route through the
 *  same firmware-aware picker as a key binding. */
function BindingSlotRow({
    action,
    label,
    firmware,
    onEdit,
    onClear,
}: {
    action: CanonAction | undefined
    label: string
    firmware?: string[]
    onEdit: () => void
    onClear: () => void
}): JSX.Element {
    const cap = builderCapProps(action)
    const code = builderBindingCode(action, firmware)
    return (
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-background p-2">
            <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${label}`}
                className="relative shrink-0"
                style={{ width: 38, height: 38 }}
            >
                <KeyButton
                    oneU={38}
                    width={1}
                    height={1}
                    hoverZoom={false}
                    tapText={cap?.tapText}
                    header={cap?.header}
                    actionLabel={code}
                    category={cap?.category}
                    accentCategory={cap?.accentCategory}
                    holdTap={cap?.holdTap}
                    mods={cap?.mods}
                    showHeaderTag={!!(cap?.header || code)}
                >
                    {cap && !cap.holdTap ? cap.tapText : undefined}
                </KeyButton>
            </button>
            <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                    {label}
                </div>
                <div className="truncate text-[12.5px] font-bold">
                    {cap?.tapText ?? '▽'}
                </div>
            </div>
            <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${label} binding`}
                className="grid size-8 place-items-center rounded-lg border text-foreground transition-colors"
                style={{
                    background:
                        'color-mix(in oklch, var(--primary) 16%, var(--background))',
                    borderColor:
                        'color-mix(in oklch, var(--primary) 45%, transparent)',
                }}
            >
                <Pencil size={13} />
            </button>
            <button
                type="button"
                onClick={onClear}
                aria-label={`Clear ${label} binding`}
                className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
            >
                <X size={14} />
            </button>
        </div>
    )
}

export function BuilderInspector(): JSX.Element {
    const config = useConfigStore((s) => s.config)
    const selection = useBuilderStore((s) => s.selection)
    const activeLayer = useBuilderStore((s) => s.activeLayer)
    const commit = useBuilderStore((s) => s.commit)
    const clearSelection = useBuilderStore((s) => s.clearSelection)
    const setSelection = useBuilderStore((s) => s.setSelection)
    const openBinding = useBuilderStore((s) => s.openBinding)
    const snapOnWire = useBuilderStore((s) => s.snapOnWire)
    const toggleSnapOnWire = useBuilderStore((s) => s.toggleSnapOnWire)
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
    // Manual wire stores a transform (auto-assign → off); when "snap on wire"
    // is on, also snap the key's position to the whole-U grid.
    const wireMatrix = (r: number, c: number): void => {
        let next = setKeyMatrix(config, index, r, c)
        if (snapOnWire) {
            next = patchKey(next, index, {
                x: snapStep(key.x, 1),
                y: snapStep(key.y, 1),
            })
        }
        commit(next)
    }
    const t = ensureTransform(config)
    const [row, col] = keyMatrix(config, index)
    const nRows = Math.max(t.rows, row + 1)
    const nCols = Math.max(t.columns, col + 1)
    const rPins = rowPins(config)
    const cPins = colPins(config)
    const rPin = (i: number): string => rPins[i] ?? `GP${i}`
    const cPin = (i: number): string => cPins[i] ?? `GP${i}`
    const layouts = config.keyboard.layouts ?? []
    const binding = config.layers[activeLayer]?.bindings[index]
    const bindingCap = builderCapProps(binding)
    const bindingCode = builderBindingCode(binding, config.keyboard.firmware)
    const layerName = config.layers[activeLayer]?.name ?? 'layer'
    const element: 'key' | 'encoder' | 'slider' = key.element ?? 'key'
    const setElement = (el: 'key' | 'encoder' | 'slider'): void =>
        commit(
            patchKey(config, index, { element: el === 'key' ? undefined : el }),
        )
    const pinLabel =
        element === 'encoder'
            ? 'Encoder pin A (direct)'
            : element === 'slider'
              ? 'ADC pin'
              : 'Direct GPIO pin (optional)'

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="text-[12px] font-semibold text-muted-foreground">
                {element === 'encoder'
                    ? 'Encoder'
                    : element === 'slider'
                      ? 'Slider'
                      : 'Key'}{' '}
                #{index}
            </div>

            <ElementTabs element={element} onSelect={setElement} />

            {element === 'encoder' && (
                <div>
                    <MiniLabel>Encoder rotary · {layerName}</MiniLabel>
                    <div className="flex flex-col gap-2">
                        {ENCODER_SLOTS.map(({ slot, label }) => (
                            <BindingSlotRow
                                key={slot}
                                label={label}
                                firmware={config.keyboard.firmware}
                                action={
                                    config.layers[activeLayer]
                                        ?.encoderBindings?.[index]?.[slot]
                                }
                                onEdit={() =>
                                    openBinding({ keyIndex: index, slot })
                                }
                                onClear={() =>
                                    commit(
                                        setEncoderBinding(
                                            config,
                                            activeLayer,
                                            index,
                                            slot,
                                            { type: 'transparent' },
                                        ),
                                    )
                                }
                            />
                        ))}
                    </div>
                </div>
            )}
            {element === 'slider' && (
                <ElementNote
                    label="Slider · analog input"
                    text="An analog slider on an ADC pin (set below). Slider value mapping is exporter metadata for now."
                />
            )}

            {/* binding (active layer) — pattern-check: skip presentational cap-preview + picker-open button, no logic */}
            {element === 'key' && (
                <div>
                    <MiniLabel>Key binding · {layerName}</MiniLabel>
                    <button
                        type="button"
                        onClick={() =>
                            openBinding({ keyIndex: index, slot: 'key' })
                        }
                        className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-primary"
                    >
                        <div
                            className="relative shrink-0"
                            style={{ width: 46, height: 46 }}
                        >
                            <KeyButton
                                oneU={46}
                                width={1}
                                height={1}
                                hoverZoom={false}
                                tapText={bindingCap?.tapText}
                                header={bindingCap?.header}
                                actionLabel={bindingCode}
                                category={bindingCap?.category}
                                accentCategory={bindingCap?.accentCategory}
                                holdTap={bindingCap?.holdTap}
                                mods={bindingCap?.mods}
                                showHeaderTag={
                                    !!(bindingCap?.header || bindingCode)
                                }
                            >
                                {bindingCap && !bindingCap.holdTap
                                    ? bindingCap.tapText
                                    : undefined}
                            </KeyButton>
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-[14px] font-extrabold">
                                {bindingCap?.tapText ?? '▽'}
                            </div>
                            <div className="text-[11.5px] text-muted-foreground">
                                {bindingCap?.header ?? 'Pass-through'}
                            </div>
                        </div>
                    </button>
                    <div className="mt-2 flex gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                openBinding({ keyIndex: index, slot: 'key' })
                            }
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-bold text-foreground transition-colors"
                            style={{
                                background:
                                    'color-mix(in oklch, var(--primary) 16%, var(--background))',
                                borderColor:
                                    'color-mix(in oklch, var(--primary) 45%, transparent)',
                            }}
                        >
                            <Pencil size={13} /> Edit binding
                        </button>
                        <button
                            type="button"
                            aria-label="Clear binding"
                            onClick={() =>
                                commit(
                                    setBinding(config, activeLayer, index, {
                                        type: 'transparent',
                                    }),
                                )
                            }
                            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                        >
                            <X size={15} />
                        </button>
                    </div>
                </div>
            )}

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
                {/* pattern-check: skip presentational FINE/STEP rotation labels, no logic */}
                <div className="mt-2 flex items-center gap-1">
                    <span className="mr-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                        Fine 5°
                    </span>
                    {[
                        ['−5°', -5],
                        ['+5°', 5],
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
                    <span className="mx-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                        Step 15°
                    </span>
                    {[
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
                                wireMatrix(Number(e.target.value), col)
                            }
                            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 font-mono text-[12.5px] font-semibold text-foreground outline-none focus:border-primary"
                        >
                            {Array.from({ length: nRows }).map((_, i) => (
                                <option key={i} value={i}>
                                    Row {i} · {rPin(i)}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Column">
                        <select
                            value={col}
                            onChange={(e) =>
                                wireMatrix(row, Number(e.target.value))
                            }
                            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 font-mono text-[12.5px] font-semibold text-foreground outline-none focus:border-primary"
                        >
                            {Array.from({ length: nCols }).map((_, i) => (
                                <option key={i} value={i}>
                                    Col {i} · {cPin(i)}
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
                        {rPin(row)}
                    </span>
                    <span className="text-muted-foreground">×</span>
                    <span
                        className="font-mono text-[12.5px] font-bold"
                        style={{ color: 'oklch(0.72 0.14 250)' }}
                    >
                        {cPin(col)}
                    </span>
                </div>
                <div className="mt-2">
                    <ToggleRow
                        label="Auto-assign row/col from position"
                        on={isAutoAssign(config)}
                        onToggle={(v) =>
                            commit(
                                v
                                    ? removeTransform(config)
                                    : applyAutoMatrix(config),
                            )
                        }
                    />
                </div>
                <div className="mt-1.5">
                    <ToggleRow
                        label="Snap to grid on row/col change"
                        on={snapOnWire}
                        onToggle={toggleSnapOnWire}
                    />
                </div>
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                    Auto-assign on: moving a key re-derives its row/column.
                    Editing row/column by hand turns it off.
                </p>
            </div>

            {/* direct GPIO pin (optional, per-key) */}
            <div>
                <MiniLabel>{pinLabel}</MiniLabel>
                <input
                    key={index}
                    defaultValue={key.pin ?? ''}
                    placeholder="e.g. GP29"
                    onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v !== (key.pin ?? ''))
                            commit(
                                patchKey(config, index, {
                                    pin: v || undefined,
                                }),
                            )
                    }}
                    className="w-full rounded-lg border border-input bg-background px-2.5 py-2 font-mono text-[13px] font-medium text-foreground outline-none focus:border-primary"
                />
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                    A single direct-wired GPIO for this key (no matrix). Export
                    metadata for now.
                </p>
            </div>
        </div>
    )
}
