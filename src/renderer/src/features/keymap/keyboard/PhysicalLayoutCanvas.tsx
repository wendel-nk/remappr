import React, {
    PropsWithChildren,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { HoldTapLabels, KeyButton } from './KeyButton.tsx'
import { clamp } from '@/lib/clampInt'
import { scalePosition } from '@/lib/scalePosition'
import { LayoutZoom } from '@/lib/helpers'
import type { ColorMode, KeyCategory } from '@/lib/keymap/keyCategory'
import type { CapStyle } from '@/stores/userSettingsStore'
import type { UnifiedLighting } from '@/features/lighting/engine'

export type KeyPosition = PropsWithChildren<{
    id?: string
    header?: string
    tapText?: string
    actionLabel?: string
    holdTap?: HoldTapLabels
    /** Chord modifier names (e.g. ["Ctrl","Shift"]) → chips above the legend. */
    mods?: string[]
    category?: KeyCategory
    accentCategory?: KeyCategory
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
    // Presentational forwards for small/clean previews (e.g. start-page device card).
    capStyleOverride?: CapStyle
    colorModeOverride?: ColorMode
    showHeaderTag?: boolean
    showCategoryDot?: boolean
    zoom?: LayoutZoom
    // Opt-in wheel-zoom + drag-pan stage with a zoom HUD. Off by default so the
    // small layout-picker preview keeps its plain auto-fit behaviour.
    pannable?: boolean
    // Opt-in rich hover tooltips on each key (tap/action/hold/type/press-count).
    tooltips?: boolean
    // RGB-simulation config; when enabled, each key renders an underglow layer.
    lighting?: UnifiedLighting | null
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

// Auto-fit sizes the key unit (oneU) itself — the design prototype's model —
// instead of transform-scaling a fixed-oneU board. Rendering caps at their real
// size keeps the 1px borders and px-fixed shadows crisp (a transform scale would
// magnify them). The relative zoom is then a plain transform on top.
const MIN_ONE_U = 34
const MAX_ONE_U = 92
const FIT_PADDING = 48

// pattern-check: skip — rename View.scale→zoom + relative-zoom semantics, no new abstraction
// User-adjusted view; null = follow auto-fit (zoom 1, no pan). `zoom` is the
// factor *relative to the auto-fit scale* — exactly the design prototype's
// model, where 1.0 = "fitted to the viewport" and the [0.4, 3.2] range is the
// same no matter how big the board or viewport is. `tx`/`ty` are the pan
// offset in viewport px (applied before the scale, like the prototype).
interface View {
    zoom: number
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
    capStyleOverride,
    colorModeOverride,
    showHeaderTag,
    showCategoryDot,
    pannable = false,
    tooltips = false,
    lighting = null,
    onPositionClicked,
    onEncoderClicked,
    onPositionContextMenu,
    pressedKeys = new Set(),
    ...props
}: PhysicalLayoutCanvasProps): JSX.Element => {
    const ref = useRef<HTMLDivElement>(null)
    const viewportRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(1)
    // Fitted key-unit size for the pannable stage (design model). Non-pannable
    // previews keep the fixed `oneU` prop and fit via the transform `scale`.
    const [fitU, setFitU] = useState(oneU)
    const [view, setView] = useState<View | null>(null)
    // True while actively panning — disables the transform transition so the
    // board tracks the pointer 1:1 instead of easing behind it.
    const [dragging, setDragging] = useState(false)

    const { zoom } = props

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

    useLayoutEffect((): (() => void) | void => {
        // Pannable stage: fit by sizing oneU (caps render at real size → crisp).
        if (pannable) {
            const vp = viewportRef.current
            if (!vp || rightMost === 0 || bottomMost === 0) return
            const fit = (): void => {
                const u = Math.min(
                    (vp.clientWidth - FIT_PADDING * 2) / rightMost,
                    (vp.clientHeight - FIT_PADDING * 2) / bottomMost,
                )
                if (Number.isFinite(u)) {
                    setFitU(clamp(u, MIN_ONE_U, MAX_ONE_U))
                }
            }
            fit()
            const ro = new ResizeObserver(fit)
            ro.observe(vp)
            return (): void => ro.disconnect()
        }

        // Non-pannable preview: keep the fixed oneU and fit via transform scale.
        const element = ref.current
        if (!element) return
        const parent = element.parentElement
        if (!parent) return
        const calculateScale = (): void => {
            if (zoom === 'auto') {
                const padding =
                    Math.min(window.innerWidth, window.innerHeight) * 0.05
                setScale(
                    Math.min(
                        parent.clientWidth /
                            (element.clientWidth + padding * 2),
                        parent.clientHeight /
                            (element.clientHeight + padding * 2),
                    ),
                )
            } else {
                setScale(zoom || 1)
            }
        }
        calculateScale()
        const resizeObserver = new ResizeObserver(calculateScale)
        resizeObserver.observe(element)
        resizeObserver.observe(parent)
        return (): void => resizeObserver.disconnect()
    }, [zoom, pannable, rightMost, bottomMost])

    // Pannable caps render at the fitted oneU; previews use the fixed prop.
    const effOneU = pannable ? fitU : oneU
    const boardW = rightMost * effOneU
    const boardH = bottomMost * effOneU

    // For the pannable stage the board is already at its fitted size, so the
    // transform is just the relative zoom (1 = fitted, crisp). Previews still
    // fold the auto-fit `scale` into the transform.
    const zoomLevel = view ? view.zoom : 1
    const effScale = pannable ? zoomLevel : scale * zoomLevel
    const tx = view ? view.tx : 0
    const ty = view ? view.ty : 0

    // Pan clamp, ported from the design prototype: keep at least half the board
    // (or the whole viewport, whichever is larger) within reach. `z` is the
    // relative zoom; boardW/boardH are already at the fitted oneU.
    const clampPan = useCallback(
        (nx: number, ny: number, z: number): { tx: number; ty: number } => {
            const vp = viewportRef.current
            if (!vp) return { tx: nx, ty: ny }
            const cw = boardW * z
            const ch = boardH * z
            const limX = Math.max(cw, vp.clientWidth) / 2
            const limY = Math.max(ch, vp.clientHeight) / 2
            return { tx: clamp(nx, -limX, limX), ty: clamp(ny, -limY, limY) }
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
            const curZoom = view ? view.zoom : 1
            const curTx = view ? view.tx : 0
            const curTy = view ? view.ty : 0
            // Fixed multiplicative step per notch (design prototype), so the feel
            // is identical on a mouse wheel and a trackpad regardless of deltaY.
            const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
            const nz = clamp(curZoom * factor, MIN_ZOOM, MAX_ZOOM)
            if (nz === curZoom) return
            const cx = e.clientX - rect.left - rect.width / 2
            const cy = e.clientY - rect.top - rect.height / 2
            // Keep the board point under the cursor fixed: k is the zoom ratio.
            const k = nz / curZoom
            const next = clampPan(
                cx - (cx - curTx) * k,
                cy - (cy - curTy) * k,
                nz,
            )
            setView({ zoom: nz, ...next })
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
        zoom: number
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
            const z = view ? view.zoom : 1
            drag.current = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                baseTx: view ? view.tx : 0,
                baseTy: view ? view.ty : 0,
                zoom: z,
                pointerId: e.pointerId,
            }
            setDragging(true)
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
                d.zoom,
            )
            setView({ zoom: d.zoom, ...next })
        },
        [clampPan],
    )

    const onPointerUp = useCallback((e: React.PointerEvent): void => {
        if (drag.current) {
            viewportRef.current?.releasePointerCapture(drag.current.pointerId)
            drag.current.active = false
        }
        setDragging(false)
        void e
    }, [])

    const onDoubleClick = useCallback((e: React.MouseEvent): void => {
        const target = e.target as HTMLElement
        if (target.closest('[data-key="true"]')) return
        setView(null)
    }, [])

    const zoomBy = useCallback(
        (factor: number): void => {
            const curZoom = view ? view.zoom : 1
            const nz = clamp(curZoom * factor, MIN_ZOOM, MAX_ZOOM)
            const k = nz / curZoom
            const next = clampPan(
                (view ? view.tx : 0) * k,
                (view ? view.ty : 0) * k,
                nz,
            )
            setView({ zoom: nz, ...next })
        },
        [view, clampPan],
    )

    const keysPositions = positions.map((p, idx) => {
        const posStyle = scalePosition(p, effOneU)
        const isEncoder = !!p.encoder
        const isSelected = isEncoder
            ? selectedEncoder?.slot === p.encoder!.slot &&
              selectedEncoder?.dir === p.encoder!.dir
            : idx === selectedPosition
        const isMultiSelected = !isEncoder && !!selectedPositions?.has(idx)
        // Underglow input: key centre normalized to the board bounds (drives the
        // spatial hue). Encoders skip the glow.
        const lightInput =
            lighting?.enabled && !isEncoder && rightMost > 0 && bottomMost > 0
                ? {
                      cfg: lighting,
                      fx: (p.x + p.width / 2) / rightMost,
                      fy: (p.y + p.height / 2) / bottomMost,
                      idx,
                  }
                : null
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
                    oneU={effOneU}
                    selected={isSelected}
                    multiSelected={isMultiSelected}
                    pressed={!isEncoder && pressedKeys.has(idx)}
                    richTooltip={tooltips && !isEncoder}
                    capStyleOverride={capStyleOverride}
                    colorModeOverride={colorModeOverride}
                    showHeaderTag={showHeaderTag}
                    showCategoryDot={showCategoryDot}
                    light={lightInput}
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
                    // Plain 2D transform — no translateZ/will-change/backface
                    // hints. Those promote the board to a composited layer with a
                    // fixed-resolution backing store, so zooming in scales a cached
                    // bitmap and the keycaps go blurry. Without them the browser
                    // re-rasterises the vector content crisply at every zoom level.
                    transform: `translate(${tx}px, ${ty}px) scale(${effScale})`,
                    transformOrigin: 'center',
                    transition: dragging ? 'none' : 'transform .08s ease-out',
                } as React.CSSProperties
            }
            ref={ref}
            {...props}
        >
            {keysPositions}
        </div>
    )

    if (!pannable) return <>{board}</>

    // Show zoom relative to fit (100% = fitted), matching the design prototype.
    const livePct = Math.round(zoomLevel * 100)
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
                className="absolute top-3 right-3 flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-1 shadow-sm"
            >
                <ZoomButton label="Zoom out" onClick={() => zoomBy(1 / 1.15)}>
                    <Minus className="size-4" />
                </ZoomButton>
                <span className="min-w-12 text-center text-xs font-mono tabular-nums text-muted-foreground">
                    {livePct}%
                </span>
                <ZoomButton label="Zoom in" onClick={() => zoomBy(1.15)}>
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
