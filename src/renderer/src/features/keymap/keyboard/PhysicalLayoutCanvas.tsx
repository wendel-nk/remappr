import React, {
    PropsWithChildren,
    useLayoutEffect,
    useRef,
    useState,
} from 'react'
import { HoldTapLabels, KeyButton } from './KeyButton.tsx'
import { scalePosition } from '@/lib/scalePosition'
import { LayoutZoom } from '@/lib/helpers'
import type { KeyCategory } from '@/lib/keymap/keyCategory'

export type KeyPosition = PropsWithChildren<{
    id?: string
    header?: string
    actionLabel?: string
    holdTap?: HoldTapLabels
    category?: KeyCategory
    heat?: number | null
    width: number
    height: number
    x: number
    y: number
    r?: number
    rx?: number
    ry?: number
    // Encoder marker (when present, KeyButton is rendered as a small dial half).
    encoder?: { slot: number; dir: 'cw' | 'ccw' }
}>

interface PhysicalLayoutCanvasProps {
    positions: Array<KeyPosition>
    selectedPosition?: number
    selectedEncoder?: { slot: number; dir: 'cw' | 'ccw' }
    oneU?: number
    hoverZoom?: boolean
    zoom?: LayoutZoom
    onPositionClicked?: (position: number) => void
    onEncoderClicked?: (slot: number, dir: 'cw' | 'ccw') => void
    // Right-click on a key (not encoder) → host shows a context menu at the
    // viewport coords. Skipped silently when undefined so callers that
    // don't want the menu don't pay for the wiring.
    onPositionContextMenu?: (
        position: number,
        coords: { x: number; y: number },
    ) => void
    pressedKeys?: Set<number>
}

export const PhysicalLayoutCanvas = ({
    positions,
    selectedPosition,
    selectedEncoder,
    oneU = 48,
    hoverZoom = true,
    onPositionClicked,
    onEncoderClicked,
    onPositionContextMenu,
    pressedKeys = new Set(),
    ...props
}: PhysicalLayoutCanvasProps): JSX.Element => {
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

        calculateScale()

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

    const keysPositions = positions.map((p, idx) => {
        const posStyle = scalePosition(p, oneU)
        const isEncoder = !!p.encoder
        const isSelected = isEncoder
            ? selectedEncoder?.slot === p.encoder!.slot &&
              selectedEncoder?.dir === p.encoder!.dir
            : idx === selectedPosition
        const handleClick = (): void => {
            if (isEncoder) {
                onEncoderClicked?.(p.encoder!.slot, p.encoder!.dir)
            } else {
                onPositionClicked?.(idx)
            }
        }
        const handleContextMenu = (e: React.MouseEvent): void => {
            if (isEncoder || !onPositionContextMenu) return
            e.preventDefault()
            onPositionContextMenu(idx, { x: e.clientX, y: e.clientY })
        }
        return (
            <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleClick()
                    }
                }}
                className="absolute data-[zoomer=true]:hover:z-[1000] leading-[0]"
                data-zoomer={hoverZoom}
                style={posStyle as React.CSSProperties}
            >
                <KeyButton
                    hoverZoom={hoverZoom}
                    oneU={oneU}
                    selected={isSelected}
                    pressed={!isEncoder && pressedKeys.has(idx)}
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
                        transform: `scale(${scale}) translateZ(0)`,
                        transformOrigin: 'center',
                        backfaceVisibility: 'hidden',
                        willChange: 'transform',
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
