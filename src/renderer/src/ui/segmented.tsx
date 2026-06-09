// Pattern check: no GoF pattern (-) — rejected — reusable presentational segmented
// control primitive (generic over option value), no abstraction warranted.
import { cn } from '@/lib/cn'

/** Inline segmented control (matches the prototype's Segmented). */
export function Segmented<T extends string>({
    value,
    options,
    onChange,
}: {
    value: T
    options: { value: T; label: string }[]
    onChange: (v: T) => void
}): JSX.Element {
    return (
        <div className="inline-flex gap-0.5 rounded-lg border border-border bg-secondary p-0.5">
            {options.map((o) => {
                const active = o.value === value
                return (
                    <button
                        key={o.value}
                        type="button"
                        onClick={() => onChange(o.value)}
                        className={cn(
                            'rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
                            active
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {o.label}
                    </button>
                )
            })}
        </div>
    )
}
