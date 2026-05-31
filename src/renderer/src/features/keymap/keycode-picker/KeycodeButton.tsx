// pattern-check: skip — additive category-colour tint on existing chip button, lookup only
import { CSSProperties } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/ui/tooltip'
import { Button } from '@/ui/button'
import { catStyle, categoryForUsage } from '@/lib/keymap/keyCategory'

interface KeycodeButtonProps {
    value?: number
    label: string
    name?: string
    aliases?: string[]
    notes?: string
    width?: number
    height?: number
    x: number
    y: number
    baseKeyValue?: number
    onSelect: (keyCode: number) => void
    // Bypass the value/onSelect path. Used by behavior-ref tiles
    // (ZMK runtime &macro_* / &combo_*) which emit a complete
    // KeyAction rather than a codec-encoded number.
    onClickOverride?: () => void
    isSelected?: boolean
}

export default function KeycodeButton({
    value,
    label,
    name,
    aliases,
    notes,
    width = 50,
    height = 50,
    x,
    y,
    baseKeyValue,
    onSelect,
    onClickOverride,
    isSelected = false,
}: KeycodeButtonProps): JSX.Element {
    const keySize = 50

    // Colour-code chips by function category (border tint + accent edge).
    const accent =
        value && value !== 0
            ? catStyle(categoryForUsage(value), 'vivid').dot
            : null

    const style: CSSProperties = {
        position: 'absolute',
        top: `${y * keySize}px`,
        left: `${x * keySize}px`,
        width: `${width - 2}px`,
        height: `${height - 2}px`,
        overflow: 'hidden',
        border: isSelected
            ? '2px solid var(--primary)'
            : `1px solid ${
                  accent
                      ? `color-mix(in oklch, ${accent} 50%, var(--border))`
                      : 'var(--border)'
              }`,
        borderLeft: !isSelected && accent ? `3px solid ${accent}` : undefined,
    }

    const handleClick = (): void => {
        if (onClickOverride) {
            onClickOverride()
            return
        }
        if (value !== undefined) {
            onSelect(value)
        }
    }

    const aliasLine = aliases && aliases.length > 0 ? aliases.join(' · ') : null

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    aria-pressed={isSelected}
                    className={`absolute aspect-square ${isSelected ? 'bg-accent text-accent-foreground' : ''}`}
                    style={style}
                    value={value}
                    data-base-key-value={baseKeyValue}
                    onClick={handleClick}
                >
                    {label}
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                <div className="font-medium">{name ?? label}</div>
                {name && name !== label ? (
                    <div className="text-xs opacity-70">{label}</div>
                ) : null}
                {aliasLine ? (
                    <div className="text-xs mt-1 opacity-80">
                        Aliases: {aliasLine}
                    </div>
                ) : null}
                {notes ? (
                    <div className="text-xs mt-1 italic opacity-70">
                        {notes}
                    </div>
                ) : null}
            </TooltipContent>
        </Tooltip>
    )
}
