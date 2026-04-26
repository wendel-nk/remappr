import { PropsWithChildren, useLayoutEffect, useRef, useState } from 'react'
import { HoldTapLabels, Key } from './Key.tsx'
import { scalePosition } from '@/utils/scalePosition'
import { LayoutZoom } from '@/utils/helpers.ts'

export type KeyPosition = PropsWithChildren<{
    id?: string
    header?: string
    holdTap?: HoldTapLabels
    width: number
    height: number
    x: number
    y: number
    r?: number
    rx?: number
    ry?: number
}>

interface PhysicalLayoutProps {
    positions: Array<KeyPosition>
    selectedPosition?: number
    oneU?: number
    hoverZoom?: boolean
    zoom?: LayoutZoom
    onPositionClicked?: (position: number) => void
    pressedKeys?: Set<number>
}

export const PhysicalLayout = ({
    positions,
    selectedPosition,
    oneU = 48,
    hoverZoom = true,
    onPositionClicked,
    pressedKeys = new Set(),
    ...props
}: PhysicalLayoutProps): JSX.Element => {
    const ref = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(1)

    const { zoom } = props

    useLayoutEffect((): (() => void) | void => {
        const element = ref.current
        if (!element) return

        const parent = element.parentElement
        if (!parent) return

        const calculateScale = (): void => {
            if (zoom === 'auto') {
                const padding =
                    Math.min(window.innerWidth, window.innerHeight) * 0.05
                const newScale = Math.min(
                    parent.clientWidth / (element.clientWidth + padding * 2),
                    parent.clientHeight / (element.clientHeight + padding * 2),
                )
                setScale(newScale)
            } else {
                setScale(zoom || 1)
            }
        }

        // Perform initial scale calculation
        calculateScale()

        // Create a ResizeObserver that recalculates the scale when dimensions change
        const resizeObserver = new ResizeObserver(calculateScale)
        resizeObserver.observe(element)
        resizeObserver.observe(parent)

        return (): void => resizeObserver.disconnect()
    }, [zoom])

    // TODO: Add a bit of padding for rotation when supported
    const { rightMost, bottomMost } = positions.reduce(
        (
            acc: { rightMost: number; bottomMost: number },
            {
                x,
                y,
                width,
                height,
            }: { x: number; y: number; width: number; height: number },
        ): { rightMost: number; bottomMost: number } => ({
            rightMost: Math.max(acc.rightMost, x + width),
            bottomMost: Math.max(acc.bottomMost, y + height),
        }),
        { rightMost: 0, bottomMost: 0 },
    )

    // console.log(positions)
    const keysPositions = positions.map((p, idx) => {
        const posStyle = scalePosition(p, oneU)
        return (
            <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => onPositionClicked?.(idx)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onPositionClicked?.(idx)
                    }
                }}
                className="absolute data-[zoomer=true]:hover:z-[1000] leading-[0]"
                data-zoomer={hoverZoom}
                style={posStyle}
            >
                <Key
                    hoverZoom={hoverZoom}
                    oneU={oneU}
                    selected={idx === selectedPosition}
                    pressed={pressedKeys.has(idx)}
                    {...p}
                />
            </div>
        )
    })
    return (
        <>
            <div
                className="relative"
                style={
                    {
                        height: bottomMost * oneU + 'px',
                        width: rightMost * oneU + 'px',
                        transform: `scale(${scale})`,
                        transformOrigin: 'center',
                    } as React.CSSProperties
                }
                ref={ref}
                {...props}
            >
                {keysPositions}
            </div>
        </>
    )
}
