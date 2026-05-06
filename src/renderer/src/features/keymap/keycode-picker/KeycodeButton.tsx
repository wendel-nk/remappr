// pattern-check: skip optional tooltip enrichment props on existing button component — mechanical prop extension
import { CSSProperties } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/ui/tooltip'
import { Button } from '@/ui/button'

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
    isSelected = false,
}: KeycodeButtonProps): JSX.Element {
    const keySize = 50

    const style: CSSProperties = {
        position: 'absolute',
        top: `${y * keySize}px`,
        left: `${x * keySize}px`,
        width: `${width - 2}px`,
        height: `${height - 2}px`,
        overflow: 'hidden',
        border: isSelected ? '2px solid blue' : '1px solid gray',
    }

    const handleClick = (): void => {
        if (value !== undefined) {
            onSelect(value)
        }
    }

    const aliasLine =
        aliases && aliases.length > 0 ? aliases.join(' · ') : null

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
