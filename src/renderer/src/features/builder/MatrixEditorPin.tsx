// pattern-check: skip — extracted presentational inline-edit chip from MatrixOverlay, local state only
//
// A GPIO pin chip rendered at a matrix run's anchor on the builder canvas.
// Click to rename: Enter or blur commits, Esc cancels. Extracted from
// MatrixOverlay's inline EditablePin so the overlay file stays focused on layout.
import { useEffect, useRef, useState } from 'react'

/** A GPIO pin chip at a run anchor: click to rename, Enter/blur commits, Esc cancels. */
export function MatrixEditorPin({
    x,
    y,
    color,
    label,
    onCommit,
}: {
    x: number
    y: number
    color: string
    label: string
    onCommit: (label: string) => void
}): JSX.Element {
    const [edit, setEdit] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    // Focus once when editing starts (was a render-time ref callback that
    // re-focused on every render); fire only when the input mounts on edit.
    useEffect(() => {
        if (edit !== null) inputRef.current?.focus()
    }, [edit])
    const commit = (): void => {
        if (edit !== null && edit.trim() && edit !== label)
            onCommit(edit.trim())
        setEdit(null)
    }
    return (
        <span
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: x, top: y, zIndex: 28 }}
        >
            {edit !== null ? (
                <input
                    ref={inputRef}
                    value={edit}
                    onChange={(e) => setEdit(e.target.value)}
                    onBlur={commit}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commit()
                        if (e.key === 'Escape') setEdit(null)
                    }}
                    className="w-14 rounded-md border bg-card px-1 py-0.5 text-center font-mono text-[11px] font-bold outline-none"
                    style={{ borderColor: color, color }}
                />
            ) : (
                <button
                    type="button"
                    onClick={() => setEdit(label)}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Click to set the GPIO pin"
                    className="cursor-pointer rounded-md border bg-card px-1.5 py-0.5 font-mono text-[11px] font-bold whitespace-nowrap"
                    style={{ borderColor: color, color }}
                >
                    {label}
                </button>
            )}
        </span>
    )
}
