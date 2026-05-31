import React, {
    PropsWithChildren,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react'
import { Minus, Plus, Maximize2 } from 'lucide-react'
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
    /** Raw lifetime press count, shown in the rich tooltip when the heatmap is on. */
    pressCount?: number | null
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

// Pattern check: no GoF pattern (-) — rejected — plain prop/callback shape additions for
// multi-select highlight + click modifiers; data plumbing, no abstraction or polymorphism.
/** Modifier keys held during a key click, used to drive multi-select. */
export interface ClickModifiers {
    shiftKey: boolean
    metaKey: boolean
    ctrlKey: boolean
}

interface PhysicalLayoutCanvasProps {
    positions: Array<KeyPosition>
    selectedPosition?: number
    // Additional positions highlighted as part of a multi-selection.
    selectedPositions?: Set<number>
    selectedEncoder?: { slot: number; dir: 'cw' | 'ccw' }
    oneU?: number
    hoverZoom?: boolean
    zoom?: LayoutZoom
    // Opt-in wheel-zoom + drag-pan stage with a zoom HUD. Off by default so the
    // small layout-picker preview keeps its plain auto-fit behaviour.
    pannable?: boolean
    // Opt-in rich hover tooltips on each key (tap/action/hold/type/press-count).
    tooltips?: boolean
    onPositionClicked?: (position: number, mods?: ClickModifiers) => void
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

const MIN_ZOOM = 0.4
const MAX_ZOOM = 3.2

const clamp = (v: number, lo: number, hi: number): number =>
    Math.min(hi, Math.max(lo, v))

// User-adjusted view (absolute scale + translate from centre); null = follow auto-fit.
interface View {
    scale: number
    tx: number
    ty: number
}

export const PhysicalLayoutCanvas = ({
    positions,
    selectedPosition,
    selectedPositions,
    selectedEncoder,
    oneU = 48,
    hoverZoom = true,
    pannable = false,
    tooltips = false,
    onPositionClicked,
    onEncoderClicked,
    onPositionContextMenu,
    pressedKeys = new Set(),
    ...props
}: PhysicalLayoutCanvasProps): JSX.Element => {
    const ref = useRef<HTMLDivElement>(null)
    const viewportRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(1)
    const [view, setView] = useState<View | null>(null)

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

    const boardW = rightMost * oneU
    const boardH = bottomMost * oneU

    const effScale = view ? view.scale : scale
    const tx = view ? view.tx : 0
    const ty = view ? view.ty : 0

    // Keep the board reachable: never let it be dragged fully out of the viewport.
    const clampPan = useCallback(
        (nx: number, ny: number, s: number): { tx: number; ty: number } => {
            const vp = viewportRef.current
            if (!vp) return { tx: nx, ty: ny }
            const pw = vp.clientWidth
            const ph = vp.clientHeight
            const maxX = Math.max(0, (boardW * s - pw) / 2) + pw * 0.45
            const maxY = Math.max(0, (boardH * s - ph) / 2) + ph * 0.45
            return { tx: clamp(nx, -maxX, maxX), ty: clamp(ny, -maxY, maxY) }
        },
        [boardW, boardH],
    )

    // Wheel-zoom centred on the cursor. Native (non-passive) listener so we can preventDefault.
    useEffect((): (() => void) | void => {
        if (!pannable) return
        const vp = viewportRef.current
        if (!vp) return
        const onWheel = (e: WheelEvent): void => {
            e.preventDefault()
            const rect = vp.getBoundingClientRect()
            const curS = view ? view.scale : scale
            const curTx = view ? view.tx : 0
            const curTy = view ? view.ty : 0
            const factor = Math.exp(-e.deltaY * 0.0015)
            const newS = clamp(curS * factor, MIN_ZOOM, MAX_ZOOM)
            const cx = e.clientX - rect.left - rect.width / 2
            const cy = e.clientY - rect.top - rect.height / 2
            const bx = (cx - curTx) / curS
            const by = (cy - curTy) / curS
            const next = clampPan(cx - bx * newS, cy - by * newS, newS)
            setView({ scale: newS, ...next })
        }
        vp.addEventListener('wheel', onWheel, { passive: false })
        return (): void => vp.removeEventListener('wheel', onWheel)
    }, [pannable, view, scale, clampPan])

    // Drag-to-pan on empty stage space. A drag that starts on a key is left alone so
    // the key still selects on click.
    const drag = useRef<{
        active: boolean
        startX: number
        startY: number
        baseTx: number
        baseTy: number
        scale: number
        pointerId: number
    } | null>(null)

    const onPointerDown = useCallback(
        (e: React.PointerEvent): void => {
            const target = e.target as HTMLElement
            if (
                target.closest('[data-key="true"]') ||
                target.closest('[data-zoomhud="true"]')
            ) {
                return
            }
            const s = view ? view.scale : scale
            drag.current = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                baseTx: view ? view.tx : 0,
                baseTy: view ? view.ty : 0,
                scale: s,
                pointerId: e.pointerId,
            }
            viewportRef.current?.setPointerCapture(e.pointerId)
        },
        [view, scale],
    )

    const onPointerMove = useCallback(
        (e: React.PointerEvent): void => {
            const d = drag.current
            if (!d?.active) return
            const next = clampPan(
                d.baseTx + (e.clientX - d.startX),
                d.baseTy + (e.clientY - d.startY),
                d.scale,
            )
            setView({ scale: d.scale, ...next })
        },
        [clampPan],
    )

    const onPointerUp = useCallback((e: React.PointerEvent): void => {
        if (drag.current) {
            viewportRef.current?.releasePointerCapture(drag.current.pointerId)
            drag.current.active = false
        }
        void e
    }, [])

    const onDoubleClick = useCallback((e: React.MouseEvent): void => {
        const target = e.target as HTMLElement
        if (target.closest('[data-key="true"]')) return
        setView(null)
    }, [])

    const zoomBy = useCallback(
        (factor: number): void => {
            const s = view ? view.scale : scale
            const newS = clamp(s * factor, MIN_ZOOM, MAX_ZOOM)
            const next = clampPan(
                (view ? view.tx : 0) * (newS / s),
                (view ? view.ty : 0) * (newS / s),
                newS,
            )
            setView({ scale: newS, ...next })
        },
        [view, scale, clampPan],
    )

    const keysPositions = positions.map((p, idx) => {
        const posStyle = scalePosition(p, oneU)
        const isEncoder = !!p.encoder
        const isSelected = isEncoder
            ? selectedEncoder?.slot === p.encoder!.slot &&
              selectedEncoder?.dir === p.encoder!.dir
            : idx === selectedPosition
        const isMultiSelected = !isEncoder && !!selectedPositions?.has(idx)
        const handleClick = (mods?: ClickModifiers): void => {
            if (isEncoder) {
                onEncoderClicked?.(p.encoder!.slot, p.encoder!.dir)
            } else {
                onPositionClicked?.(idx, mods)
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
                data-key="true"
                onClick={(e) =>
                    handleClick({
                        shiftKey: e.shiftKey,
                        metaKey: e.metaKey,
                        ctrlKey: e.ctrlKey,
                    })
                }
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
                    multiSelected={isMultiSelected}
                    pressed={!isEncoder && pressedKeys.has(idx)}
                    richTooltip={tooltips && !isEncoder}
                    {...p}
                />
            </div>
        )
    })

    const board = (
        <div
            className="relative"
            style={
                {
                    height: boardH + 'px',
                    width: boardW + 'px',
                    transform: `translate(${tx}px, ${ty}px) scale(${effScale}) translateZ(0)`,
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
    )

    if (!pannable) return <>{board}</>

    const livePct = Math.round(effScale * 100)
    return (
        <div
            ref={viewportRef}
            className="absolute inset-0 overflow-hidden flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
        >
            {board}
            <div
                data-zoomhud="true"
                className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-border bg-background/80 px-1 py-1 shadow-sm backdrop-blur"
            >
                <ZoomButton label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
                    <Minus className="size-4" />
                </ZoomButton>
                <span className="min-w-12 text-center text-xs font-mono tabular-nums text-muted-foreground">
                    {livePct}%
                </span>
                <ZoomButton label="Zoom in" onClick={() => zoomBy(1.2)}>
                    <Plus className="size-4" />
                </ZoomButton>
                <ZoomButton label="Reset view" onClick={() => setView(null)}>
                    <Maximize2 className="size-4" />
                </ZoomButton>
            </div>
        </div>
    )
}

function ZoomButton({
    label,
    onClick,
    children,
}: PropsWithChildren<{ label: string; onClick: () => void }>): JSX.Element {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-accent transition-colors"
        >
            {children}
        </button>
    )
}
