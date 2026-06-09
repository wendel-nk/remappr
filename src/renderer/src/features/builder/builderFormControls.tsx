// pattern-check: skip — shared presentational form-control primitives consolidated
// from BuilderMetaForm + BuilderInspector (dedupe); plain inputs, no abstraction.
//
// The builder's small reusable form controls. BuilderMetaForm and BuilderInspector
// each grew their own copies of these; this is the single source. Text inputs hold
// a local draft and commit (one undo entry) on blur/Enter; numeric/toggle/slider
// controls commit immediately (sliders coalesce a drag via builderStore.arm).
import { useEffect, useRef, useState } from 'react'
import { Switch } from '@/ui/switch'
import useBuilderStore from '@/stores/builderStore'

/** Text input that holds a local draft and commits (with history) on blur/Enter. */
export function TextField({
    value,
    onCommit,
    placeholder,
    mono,
    list,
}: {
    value: string
    onCommit: (v: string) => void
    placeholder?: string
    mono?: boolean
    list?: string
}): JSX.Element {
    const [draft, setDraft] = useState(value)
    const dirty = useRef(false)
    // Keep the draft in sync when the underlying value changes externally.
    useEffect(() => {
        if (!dirty.current) setDraft(value)
    }, [value])
    const flush = (): void => {
        dirty.current = false
        if (draft !== value) onCommit(draft)
    }
    return (
        <input
            value={draft}
            placeholder={placeholder}
            list={list}
            onChange={(e) => {
                dirty.current = true
                setDraft(e.target.value)
            }}
            onBlur={flush}
            onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            className={`w-full rounded-lg border border-input bg-background px-2.5 py-2 text-[13px] font-medium text-foreground outline-none focus:border-primary ${mono ? 'font-mono' : ''}`}
        />
    )
}

/** Multiline draft input; commits (with history) on blur. */
export function TextArea({
    value,
    onCommit,
    placeholder,
    rows = 4,
}: {
    value: string
    onCommit: (v: string) => void
    placeholder?: string
    rows?: number
}): JSX.Element {
    const [draft, setDraft] = useState(value)
    const dirty = useRef(false)
    useEffect(() => {
        if (!dirty.current) setDraft(value)
    }, [value])
    return (
        <textarea
            value={draft}
            placeholder={placeholder}
            rows={rows}
            spellCheck={false}
            onChange={(e) => {
                dirty.current = true
                setDraft(e.target.value)
            }}
            onBlur={() => {
                dirty.current = false
                if (draft !== value) onCommit(draft)
            }}
            className="w-full resize-y rounded-lg border border-input bg-background px-2.5 py-2 font-mono text-[12px] leading-snug text-foreground outline-none focus:border-primary"
        />
    )
}

/** Read-only generated-file preview (live .conf / config.h / rules.mk). */
export function FilePreview({ text }: { text: string }): JSX.Element {
    return (
        <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-muted/40 px-2.5 py-2 font-mono text-[11px] leading-snug text-muted-foreground">
            {text}
        </pre>
    )
}

/** A label + Switch row. `dense` matches the inspector's slightly smaller label. */
export function ToggleRow({
    on,
    onToggle,
    label,
    dense,
}: {
    on: boolean
    onToggle: (v: boolean) => void
    label: string
    dense?: boolean
}): JSX.Element {
    return (
        <label className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-2.5 py-2">
            <span
                className={`${dense ? 'text-[12.5px]' : 'text-[13px]'} font-medium`}
            >
                {label}
            </span>
            <Switch checked={on} onCheckedChange={onToggle} />
        </label>
    )
}

/** Range slider that coalesces a drag into one history entry: it arms on
 *  mousedown and ends the gesture on release; `onChange` should route through
 *  builderStore.liveCommit so the first tick pushes one snapshot. */
export function HistorySlider({
    value,
    onChange,
}: {
    value: number
    onChange: (v: number) => void
}): JSX.Element {
    const arm = useBuilderStore((s) => s.arm)
    const endGesture = useBuilderStore((s) => s.endGesture)
    return (
        <input
            type="range"
            min={0}
            max={100}
            value={value}
            onMouseDown={arm}
            onChange={(e) => onChange(Number(e.target.value))}
            onMouseUp={endGesture}
            onBlur={endGesture}
            className="w-full accent-primary"
        />
    )
}

/** Label + content wrapper used by inspector fields. */
export function Field({
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

/** Numeric field that commits a number immediately (geometry is discrete). */
export function NumInput({
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

/** Optional-number input; empty clears it (firmware defaults the range). */
export function RangeInput({
    value,
    onChange,
}: {
    value: number | undefined
    onChange: (v: number | undefined) => void
}): JSX.Element {
    return (
        <input
            type="number"
            value={value ?? ''}
            placeholder="auto"
            onChange={(e) =>
                onChange(
                    e.target.value === '' ? undefined : Number(e.target.value),
                )
            }
            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 font-mono text-[12.5px] font-semibold text-foreground outline-none focus:border-primary"
        />
    )
}
