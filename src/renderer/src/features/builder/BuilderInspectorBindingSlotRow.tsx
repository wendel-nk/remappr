// pattern-check: skip presentational cap-preview + edit/clear row, reuses capProps, no logic
import { Pencil, X } from 'lucide-react'
import { KeyButton } from '@/features/keymap/keyboard/KeyButton'
import type { CanonAction } from '@firmware/config'
import { builderBindingCode, builderCapProps } from './builderCapProps'

/** One compact binding row: a cap preview + slot label + edit / clear. Shared by
 *  the encoder rotary slots (cw / ccw / press); opening edits route through the
 *  same firmware-aware picker as a key binding. */
export function BindingSlotRow({
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
