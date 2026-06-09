// pattern-check: skip — presentational resize-handle div extracted from BuilderCanvas, no abstraction

/** A small square resize handle. */
export function Handle({
    cursor,
    style,
    onDown,
}: {
    kind: string
    cursor: string
    style: React.CSSProperties
    onDown: (e: React.MouseEvent) => void
}): JSX.Element {
    return (
        // A mouse-driven resize grip (drag only) — no keyboard/role semantics.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
            onMouseDown={onDown}
            className="absolute rounded-[3px]"
            style={{
                width: 11,
                height: 11,
                background: 'var(--background)',
                border: '2px solid var(--primary)',
                cursor,
                zIndex: 6,
                ...style,
            }}
        />
    )
}
