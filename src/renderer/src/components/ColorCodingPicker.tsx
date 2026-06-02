// Pattern check: no GoF pattern (-) — rejected — presentational segmented control bound
// to a single store field; no abstraction warranted.
import { cn } from '@/lib/cn'
import useUserSettingsStore, {
    type ColorCodingMode,
} from '@/stores/userSettingsStore'

const OPTIONS: { value: ColorCodingMode; label: string }[] = [
    { value: 'off', label: 'Off' },
    { value: 'subtle', label: 'Subtle' },
    { value: 'vivid', label: 'Vivid' },
]

export function ColorCodingPicker(): JSX.Element {
    const colorMode = useUserSettingsStore((s) => s.colorMode)
    const setColorMode = useUserSettingsStore((s) => s.setColorMode)

    return (
        <div
            role="radiogroup"
            aria-label="Colour coding intensity"
            className="inline-flex rounded-md border bg-muted/40 p-0.5"
        >
            {OPTIONS.map(({ value, label }) => {
                const active = colorMode === value
                return (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setColorMode(value)}
                        className={cn(
                            'rounded px-3 py-1 text-sm font-medium transition-colors',
                            active
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {label}
                    </button>
                )
            })}
        </div>
    )
}
