// pattern-check: skip — static presentational placeholder body, props in / JSX out, no abstraction
/** Placeholder body for a not-yet-implemented section. */
export function ComingSoon({
    title,
    note,
}: {
    title: string
    note: string
}): JSX.Element {
    return (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
            <span className="text-sm font-semibold">{title}</span>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                {note}
            </p>
        </div>
    )
}
