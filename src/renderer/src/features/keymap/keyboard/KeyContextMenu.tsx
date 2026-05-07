// pattern-check: skip transient context-menu primitive used only by PhysicalLayoutCanvas — no abstraction warranted
// Pattern check: no GoF pattern (-) — rejected — small controlled context menu for copy/paste; click-outside + Escape dismiss, no patterns apply.
import { useEffect, useRef } from 'react'

interface MenuItem {
    label: string
    onSelect: () => void
    disabled?: boolean
}

interface Props {
    open: boolean
    x: number
    y: number
    items: MenuItem[]
    onClose: () => void
}

export function KeyContextMenu({
    open,
    x,
    y,
    items,
    onClose,
}: Props): JSX.Element | null {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const handlePointerDown = (e: PointerEvent): void => {
            if (!ref.current) return
            if (!ref.current.contains(e.target as Node)) onClose()
        }
        const handleKey = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('pointerdown', handlePointerDown, true)
        document.addEventListener('keydown', handleKey)
        return (): void => {
            document.removeEventListener('pointerdown', handlePointerDown, true)
            document.removeEventListener('keydown', handleKey)
        }
    }, [open, onClose])

    if (!open) return null

    return (
        <div
            ref={ref}
            className="fixed z-[2000] min-w-[140px] rounded-md border border-border bg-popover text-popover-foreground shadow-md py-1"
            style={{ left: x, top: y }}
            role="menu"
        >
            {items.map((item) => (
                <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                        if (item.disabled) return
                        item.onSelect()
                        onClose()
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {item.label}
                </button>
            ))}
        </div>
    )
}
