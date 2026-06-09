// pattern-check: skip presentational bulk-action button, no logic
/** A bulk-action button (icon + label). */
export function BulkBtn({
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
