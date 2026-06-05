// Pattern check: no GoF pattern (-) — rejected — presentational editable canvas
// porting the prototype's pointer interactions (marquee / multi-drag / resize /
// two-zone rotate / fine snap); imperative DOM handlers, no GoF abstraction.
//
// The builder's editing surface, ported 1:1 from app/builder/BuilderCanvas.jsx.
// Reuses the production KeyButton for cap visuals (theme + cap-style + category
// parity) inside an absolutely-positioned editable wrapper that adds the
// selection handles + 5° rotate ring. Pan/zoom + fit math mirror
// PhysicalLayoutCanvas. Geometry mutations go through geometryEditor.updateKeys;
// history coalescing is handled by builderStore (arm → liveCommit → endGesture).
//
/* eslint-disable jsx-a11y/no-static-element-interactions -- this is a
   pointer-driven canvas editor (drag/marquee/resize/rotate); keyboard editing is
   provided at the builder level (arrow-nudge, ⌘Z, delete, etc.), not per div. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { RotateCw, SlidersHorizontal } from 'lucide-react'
import { KeyButton } from '@/features/keymap/keyboard/KeyButton'
import { scalePosition } from '@/lib/scalePosition'
import useConfigStore from '@/stores/configStore'
import useBuilderStore from '@/stores/builderStore'
import { snap as snapStep, updateKeys } from './geometryEditor'
import { splitInfo } from './builderMatrix'
import { resolvedTransform } from './builderInspectorOps'
import { builderCapProps, builderBindingCode } from './builderCapProps'
import {
    addCol,
    addRow,
    colPins,
    rowPins,
    setColPin,
    setRowPin,
} from './builderPins'
import { MatrixOverlay } from './MatrixOverlay'
import type { CanonGeometry } from '@firmware/config'

const Z_MIN = 0.25
const Z_MAX = 4
const GRID_U = 0.125
const FIT_PAD = 70
const MIN_U = 26
const MAX_U = 110

const clampZ = (z: number): number => Math.max(Z_MIN, Math.min(Z_MAX, z))
const round3 = (v: number): number => Math.round(v * 1000) / 1000

interface Bounds {
    maxX: number
    maxY: number
}
function boardBounds(keys: CanonGeometry[]): Bounds {
    let maxX = 0
    let maxY = 0
    for (const k of keys) {
        maxX = Math.max(maxX, k.x + k.w)
        maxY = Math.max(maxY, k.y + k.h)
    }
    return { maxX, maxY }
}

/** Padded canvas extent in key-units (min 4×4 board + 1u margin). */
function computeCanvas(keys: CanonGeometry[]): {
    canvasW: number
    canvasH: number
} {
    const { maxX, maxY } = boardBounds(keys)
    return { canvasW: Math.max(maxX, 4) + 1, canvasH: Math.max(maxY, 4) + 1 }
}

type HandleKind = 'se' | 'e' | 's' | 'rotate'

export function BuilderCanvas(): JSX.Element {
    const config = useConfigStore((s) => s.config)
    const selection = useBuilderStore((s) => s.selection)
    const view = useBuilderStore((s) => s.view)
    const matrixView = useBuilderStore((s) => s.matrixView)
    const activeVariant = useBuilderStore((s) => s.activeVariant)
    const activeLayer = useBuilderStore((s) => s.activeLayer)

    const ref = useRef<HTMLDivElement>(null)
    const [oneU, setOneU] = useState(64)
    const oneURef = useRef(oneU)
    // Keep the imperative handlers' oneU fresh without writing the ref in render.
    useEffect(() => {
        oneURef.current = oneU
    }, [oneU])
    const [marquee, setMarquee] = useState<{
        x1: number
        y1: number
        x2: number
        y2: number
    } | null>(null)
    const [spacePan, setSpacePan] = useState(false)
    const [grabbing, setGrabbing] = useState(false)

    const keys = config?.keyboard.keys ?? []
    const { canvasW, canvasH } = computeCanvas(keys)

    // Fit oneU to the viewport (caps render at real size → crisp at every zoom).
    useLayoutEffect(() => {
        const el = ref.current
        if (!el) return
        const fit = (): void => {
            const u = Math.min(
                (el.clientWidth - FIT_PAD * 2) / canvasW,
                (el.clientHeight - FIT_PAD * 2) / canvasH,
            )
            if (Number.isFinite(u)) setOneU(Math.max(MIN_U, Math.min(MAX_U, u)))
        }
        fit()
        const ro = new ResizeObserver(fit)
        ro.observe(el)
        return () => ro.disconnect()
    }, [canvasW, canvasH])

    // Wheel-zoom centred on the cursor (native non-passive listener).
    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onWheel = (e: WheelEvent): void => {
            e.preventDefault()
            const v = useBuilderStore.getState().view
            const rect = el.getBoundingClientRect()
            const cx = e.clientX - rect.left - rect.width / 2
            const cy = e.clientY - rect.top - rect.height / 2
            const nz = clampZ(v.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12))
            if (nz === v.zoom) return
            const k = nz / v.zoom
            useBuilderStore.getState().setView({
                zoom: nz,
                panX: cx - (cx - v.panX) * k,
                panY: cy - (cy - v.panY) * k,
            })
        }
        el.addEventListener('wheel', onWheel, { passive: false })
        return () => el.removeEventListener('wheel', onWheel)
    }, [])

    // Space = temporary pan mode.
    useEffect(() => {
        const dn = (e: KeyboardEvent): void => {
            const t = e.target as HTMLElement
            if (
                e.code === 'Space' &&
                t.tagName !== 'INPUT' &&
                t.tagName !== 'TEXTAREA'
            ) {
                e.preventDefault()
                setSpacePan(true)
            }
        }
        const up = (e: KeyboardEvent): void => {
            if (e.code === 'Space') setSpacePan(false)
        }
        window.addEventListener('keydown', dn)
        window.addEventListener('keyup', up)
        return () => {
            window.removeEventListener('keydown', dn)
            window.removeEventListener('keyup', up)
        }
    }, [])

    // ── screen → key-unit coordinate transforms ──
    const screenToU = (
        clientX: number,
        clientY: number,
    ): { ux: number; uy: number } => {
        const el = ref.current!
        const rect = el.getBoundingClientRect()
        const v = useBuilderStore.getState().view
        const u = oneURef.current
        const { canvasW: cw, canvasH: ch } = computeCanvas(
            useConfigStore.getState().config?.keyboard.keys ?? [],
        )
        const innerW = cw * u
        const innerH = ch * u
        const px =
            (clientX - rect.left - rect.width / 2 - v.panX) / v.zoom +
            innerW / 2
        const py =
            (clientY - rect.top - rect.height / 2 - v.panY) / v.zoom +
            innerH / 2
        return { ux: px / u, uy: py / u }
    }
    const dUF = (dpx: number): number =>
        dpx / (oneURef.current * useBuilderStore.getState().view.zoom)
    const maybeSnap = (v: number): number =>
        useBuilderStore.getState().snapping ? snapStep(v, GRID_U) : round3(v)

    // ── pan ──
    const startPan = (e: React.MouseEvent): void => {
        e.preventDefault()
        setGrabbing(true)
        const start = { x: e.clientX, y: e.clientY }
        const base = { ...useBuilderStore.getState().view }
        const move = (ev: MouseEvent): void =>
            useBuilderStore.getState().setView({
                panX: base.panX + (ev.clientX - start.x),
                panY: base.panY + (ev.clientY - start.y),
            })
        const up = (): void => {
            setGrabbing(false)
            window.removeEventListener('mousemove', move)
            window.removeEventListener('mouseup', up)
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
    }

    // ── background: pan (space/middle) or marquee select ──
    const onBgDown = (e: React.MouseEvent): void => {
        const target = e.target as HTMLElement
        if (target.closest('[data-key]')) return
        if (spacePan || e.button === 1) {
            startPan(e)
            return
        }
        if (e.button !== 0) return
        const startU = screenToU(e.clientX, e.clientY)
        const startPx = { x: e.clientX, y: e.clientY }
        const add = e.shiftKey || e.metaKey || e.ctrlKey
        const baseSel = add
            ? new Set(useBuilderStore.getState().selection)
            : new Set<number>()
        let started = false
        const move = (ev: MouseEvent): void => {
            if (!started) {
                if (
                    Math.abs(ev.clientX - startPx.x) < 4 &&
                    Math.abs(ev.clientY - startPx.y) < 4
                )
                    return
                started = true
                useBuilderStore.getState().setSelection(new Set(baseSel))
            }
            const cur = screenToU(ev.clientX, ev.clientY)
            const r = {
                x1: Math.min(startU.ux, cur.ux),
                y1: Math.min(startU.uy, cur.uy),
                x2: Math.max(startU.ux, cur.ux),
                y2: Math.max(startU.uy, cur.uy),
            }
            setMarquee(r)
            const hit = new Set(baseSel)
            const ks = useConfigStore.getState().config?.keyboard.keys ?? []
            ks.forEach((k, i) => {
                const cx = k.x + k.w / 2
                const cy = k.y + k.h / 2
                if (cx >= r.x1 && cx <= r.x2 && cy >= r.y1 && cy <= r.y2)
                    hit.add(i)
            })
            useBuilderStore.getState().setSelection(hit)
        }
        const up = (): void => {
            if (!started && !add) useBuilderStore.getState().clearSelection()
            setMarquee(null)
            window.removeEventListener('mousemove', move)
            window.removeEventListener('mouseup', up)
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
    }

    // ── key body: select + drag-move ──
    const onKeyDown = (index: number, e: React.MouseEvent): void => {
        if (spacePan || e.button === 1) {
            startPan(e)
            return
        }
        if (e.button !== 0) return
        e.stopPropagation()
        const store = useBuilderStore.getState()
        const multi = e.shiftKey || e.metaKey || e.ctrlKey
        let sel = new Set(store.selection)
        if (multi) {
            if (sel.has(index)) sel.delete(index)
            else sel.add(index)
        } else if (!sel.has(index)) {
            sel = new Set([index])
        }
        store.setSelection(sel)
        const ids = sel.size ? sel : new Set([index])
        const base = useConfigStore.getState().config
        if (!base) return
        const orig = new Map<number, CanonGeometry>()
        base.keyboard.keys.forEach((k, i) => {
            if (ids.has(i)) orig.set(i, k)
        })
        store.arm()
        const start = { x: e.clientX, y: e.clientY }
        let moved = false
        const move = (ev: MouseEvent): void => {
            if (
                !moved &&
                Math.abs(ev.clientX - start.x) < 3 &&
                Math.abs(ev.clientY - start.y) < 3
            )
                return
            moved = true
            const dx = dUF(ev.clientX - start.x)
            const dy = dUF(ev.clientY - start.y)
            const next = updateKeys(base, (k, i) => {
                if (!ids.has(i)) return k
                const o = orig.get(i)!
                return {
                    ...k,
                    x: maybeSnap(o.x + dx),
                    y: maybeSnap(o.y + dy),
                    ...(o.rx !== undefined ? { rx: round3(o.rx + dx) } : {}),
                    ...(o.ry !== undefined ? { ry: round3(o.ry + dy) } : {}),
                }
            })
            useBuilderStore.getState().liveCommit(next)
        }
        const up = (): void => {
            useBuilderStore.getState().endGesture()
            window.removeEventListener('mousemove', move)
            window.removeEventListener('mouseup', up)
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
    }

    // ── resize / rotate handles (single key) ──
    const onHandle = (
        index: number,
        e: React.MouseEvent,
        kind: HandleKind,
    ): void => {
        e.stopPropagation()
        const base = useConfigStore.getState().config
        if (!base) return
        const o = base.keyboard.keys[index]
        useBuilderStore.getState().arm()
        const start = { x: e.clientX, y: e.clientY }
        // Screen-space center of the key, for rotate angle math.
        const center = (): { sx: number; sy: number } => {
            const el = ref.current!
            const rect = el.getBoundingClientRect()
            const v = useBuilderStore.getState().view
            const u = oneURef.current
            const { canvasW: cw, canvasH: ch } = computeCanvas(
                useConfigStore.getState().config?.keyboard.keys ?? [],
            )
            const innerW = cw * u
            const innerH = ch * u
            const cxU = o.x + o.w / 2
            const cyU = o.y + o.h / 2
            return {
                sx:
                    rect.left +
                    rect.width / 2 +
                    v.panX +
                    (cxU * u - innerW / 2) * v.zoom,
                sy:
                    rect.top +
                    rect.height / 2 +
                    v.panY +
                    (cyU * u - innerH / 2) * v.zoom,
            }
        }
        const ctr = kind === 'rotate' ? center() : null
        const move = (ev: MouseEvent): void => {
            let next
            if (kind === 'rotate' && ctr) {
                let ang =
                    (Math.atan2(ev.clientY - ctr.sy, ev.clientX - ctr.sx) *
                        180) /
                        Math.PI +
                    90
                const dist = Math.hypot(
                    ev.clientX - ctr.sx,
                    ev.clientY - ctr.sy,
                )
                const ringPx =
                    oneURef.current *
                    useBuilderStore.getState().view.zoom *
                    0.95
                if (ev.shiftKey) ang = Math.round(ang / 15) * 15
                else if (dist > ringPx) ang = Math.round(ang / 5) * 5
                next = updateKeys(base, (k, i) =>
                    i === index
                        ? {
                              ...k,
                              r: round3(ang),
                              rx: o.x + o.w / 2,
                              ry: o.y + o.h / 2,
                          }
                        : k,
                )
            } else {
                const dx = dUF(ev.clientX - start.x)
                const dy = dUF(ev.clientY - start.y)
                next = updateKeys(base, (k, i) => {
                    if (i !== index) return k
                    let w = o.w
                    let h = o.h
                    if (kind === 'se' || kind === 'e')
                        w = Math.max(0.25, maybeSnap(o.w + dx))
                    if (kind === 'se' || kind === 's')
                        h = Math.max(0.25, maybeSnap(o.h + dy))
                    return { ...k, w, h }
                })
            }
            useBuilderStore.getState().liveCommit(next)
        }
        const up = (): void => {
            useBuilderStore.getState().endGesture()
            window.removeEventListener('mousemove', move)
            window.removeEventListener('mouseup', up)
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
    }

    const innerW = canvasW * oneU
    const innerH = canvasH * oneU
    const panCursor = grabbing ? 'grabbing' : spacePan ? 'grab' : 'default'
    // Two-piece divider: only when the board is flagged split and a clear gap exists.
    const split = config?.keyboard.split ? splitInfo(keys) : null

    return (
        <div
            ref={ref}
            onMouseDown={onBgDown}
            onDoubleClick={(e) => {
                const t = e.target as HTMLElement
                if (!t.closest('[data-key]'))
                    useBuilderStore.getState().resetView()
            }}
            className="absolute inset-0 flex select-none items-center justify-center overflow-hidden"
            style={{ cursor: panCursor }}
        >
            <div
                className="relative"
                style={{
                    width: innerW,
                    height: innerH,
                    transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
                    transformOrigin: 'center',
                    transition: grabbing ? 'none' : 'transform .08s ease-out',
                }}
            >
                {/* grid underlay — minor (snap) + major (1U) */}
                <svg
                    width={innerW}
                    height={innerH}
                    className="pointer-events-none absolute inset-0 opacity-60"
                >
                    <defs>
                        <pattern
                            id="bgridminor"
                            width={oneU * GRID_U}
                            height={oneU * GRID_U}
                            patternUnits="userSpaceOnUse"
                        >
                            <path
                                d={`M ${oneU * GRID_U} 0 L 0 0 0 ${oneU * GRID_U}`}
                                fill="none"
                                stroke="color-mix(in oklch, var(--foreground) 5%, transparent)"
                                strokeWidth="1"
                            />
                        </pattern>
                        <pattern
                            id="bgrid"
                            width={oneU}
                            height={oneU}
                            patternUnits="userSpaceOnUse"
                        >
                            <rect
                                width={oneU}
                                height={oneU}
                                fill="url(#bgridminor)"
                            />
                            <path
                                d={`M ${oneU} 0 L 0 0 0 ${oneU}`}
                                fill="none"
                                stroke="color-mix(in oklch, var(--foreground) 13%, transparent)"
                                strokeWidth="1"
                            />
                        </pattern>
                    </defs>
                    <rect width={innerW} height={innerH} fill="url(#bgrid)" />
                </svg>

                {/* two-piece split divider + LEFT/RIGHT section labels */}
                {split &&
                    (() => {
                        const lx = split.mid * oneU
                        const labelStyle: React.CSSProperties = {
                            transform: 'translateY(-100%)',
                            fontSize: Math.max(11, oneU * 0.2),
                            fontWeight: 800,
                            letterSpacing: '.04em',
                            color: 'color-mix(in oklch, var(--primary) 80%, var(--foreground))',
                            background: 'var(--background)',
                            padding: '2px 10px',
                            borderRadius: 7,
                            border: '1px solid var(--border)',
                            fontFamily: "'JetBrains Mono', monospace",
                        }
                        return (
                            <>
                                <div
                                    className="pointer-events-none absolute top-0"
                                    style={{
                                        left: lx - 1,
                                        width: 2,
                                        height: innerH,
                                        background:
                                            'repeating-linear-gradient(180deg, color-mix(in oklch, var(--primary) 55%, transparent) 0 8px, transparent 8px 16px)',
                                        zIndex: 3,
                                    }}
                                />
                                <div
                                    className="pointer-events-none absolute flex justify-center"
                                    style={{
                                        left: 0,
                                        top: -2,
                                        width: lx,
                                        zIndex: 3,
                                    }}
                                >
                                    <span style={labelStyle}>
                                        LEFT · {split.leftCount}
                                    </span>
                                </div>
                                <div
                                    className="pointer-events-none absolute flex justify-center"
                                    style={{
                                        left: lx,
                                        top: -2,
                                        width: innerW - lx,
                                        zIndex: 3,
                                    }}
                                >
                                    <span style={labelStyle}>
                                        RIGHT · {split.rightCount}
                                    </span>
                                </div>
                            </>
                        )
                    })()}

                {keys.map((k, i) => {
                    const lone = selection.size === 1 && selection.has(i)
                    const sized = selection.has(i)
                    // Dim keys tagged into a different variant when one is active.
                    const dimmed =
                        activeVariant !== '' &&
                        k.variant !== undefined &&
                        k.variant !== '' &&
                        k.variant !== activeVariant
                    const binding = config?.layers[activeLayer]?.bindings[i]
                    const legend = builderCapProps(binding)
                    const bindingCode = builderBindingCode(
                        binding,
                        config?.keyboard.firmware,
                    )
                    return (
                        <div
                            key={i}
                            data-key={i}
                            className="absolute leading-[0]"
                            style={{
                                ...scalePosition(k, oneU),
                                cursor: 'move',
                                zIndex: sized ? 20 : 2,
                                opacity: dimmed ? 0.25 : 1,
                            }}
                            onMouseDown={(e) => onKeyDown(i, e)}
                        >
                            <KeyButton
                                oneU={oneU}
                                width={k.w}
                                height={k.h}
                                hoverZoom={false}
                                selected={lone}
                                multiSelected={sized && !lone}
                                tapText={legend?.tapText}
                                header={legend?.header}
                                actionLabel={bindingCode}
                                category={legend?.category}
                                accentCategory={legend?.accentCategory}
                                holdTap={legend?.holdTap}
                                mods={legend?.mods}
                                showHeaderTag={
                                    !!(legend?.header || bindingCode)
                                }
                            >
                                {legend && !legend.holdTap
                                    ? legend.tapText
                                    : undefined}
                            </KeyButton>
                            {k.element && (
                                <span
                                    className="pointer-events-none absolute right-1 top-1 text-primary"
                                    title={k.element}
                                >
                                    {k.element === 'encoder' ? (
                                        <RotateCw
                                            size={Math.max(10, oneU * 0.2)}
                                        />
                                    ) : (
                                        <SlidersHorizontal
                                            size={Math.max(10, oneU * 0.2)}
                                        />
                                    )}
                                </span>
                            )}
                            {(k.w !== 1 || k.h !== 1) && (
                                <span
                                    className="pointer-events-none absolute left-1 top-1 font-mono font-bold text-primary"
                                    style={{
                                        fontSize: Math.max(7, oneU * 0.12),
                                    }}
                                >
                                    {k.w}
                                    {k.h !== k.w ? '×' + k.h : ''}u
                                </span>
                            )}
                            {lone && (
                                <>
                                    {/* 5° snap ring */}
                                    <div
                                        className="pointer-events-none absolute rounded-full"
                                        style={{
                                            left: '50%',
                                            top: '50%',
                                            width: oneU * 1.9,
                                            height: oneU * 1.9,
                                            marginLeft: -oneU * 0.95,
                                            marginTop: -oneU * 0.95,
                                            border: '1px dashed color-mix(in oklch, var(--primary) 38%, transparent)',
                                            zIndex: 4,
                                        }}
                                    />
                                    <Handle
                                        kind="se"
                                        cursor="nwse-resize"
                                        style={{ right: -5, bottom: -5 }}
                                        onDown={(e) => onHandle(i, e, 'se')}
                                    />
                                    <Handle
                                        kind="e"
                                        cursor="ew-resize"
                                        style={{
                                            right: -5,
                                            top: '50%',
                                            marginTop: -5,
                                        }}
                                        onDown={(e) => onHandle(i, e, 'e')}
                                    />
                                    <Handle
                                        kind="s"
                                        cursor="ns-resize"
                                        style={{
                                            bottom: -5,
                                            left: '50%',
                                            marginLeft: -5,
                                        }}
                                        onDown={(e) => onHandle(i, e, 's')}
                                    />
                                    {/* rotate handle + stem */}
                                    <div
                                        onMouseDown={(e) =>
                                            onHandle(i, e, 'rotate')
                                        }
                                        className="absolute grid cursor-grab place-items-center rounded-full"
                                        style={{
                                            top: -oneU * 0.34,
                                            left: '50%',
                                            marginLeft: -7,
                                            width: 14,
                                            height: 14,
                                            background: 'var(--background)',
                                            border: '2px solid var(--primary)',
                                            zIndex: 6,
                                        }}
                                    >
                                        <RotateCw
                                            size={9}
                                            className="text-primary"
                                        />
                                    </div>
                                    <div
                                        className="absolute bg-primary"
                                        style={{
                                            top: -oneU * 0.34 + 14,
                                            left: '50%',
                                            width: 2,
                                            height: oneU * 0.2,
                                            transform: 'translateX(-1px)',
                                        }}
                                    />
                                </>
                            )}
                        </div>
                    )
                })}

                {matrixView && keys.length > 0 && config && (
                    <MatrixOverlay
                        keys={keys}
                        transform={resolvedTransform(config)}
                        oneU={oneU}
                        innerW={innerW}
                        innerH={innerH}
                        rowPins={rowPins(config)}
                        colPins={colPins(config)}
                        onSetRowPin={(i, v) =>
                            useBuilderStore
                                .getState()
                                .commit(setRowPin(config, i, v))
                        }
                        onSetColPin={(j, v) =>
                            useBuilderStore
                                .getState()
                                .commit(setColPin(config, j, v))
                        }
                        onAddRow={() =>
                            useBuilderStore
                                .getState()
                                .commit(addRow(config).config)
                        }
                        onAddCol={() =>
                            useBuilderStore
                                .getState()
                                .commit(addCol(config).config)
                        }
                    />
                )}

                {marquee && (
                    <div
                        className="pointer-events-none absolute rounded"
                        style={{
                            left: marquee.x1 * oneU,
                            top: marquee.y1 * oneU,
                            width: (marquee.x2 - marquee.x1) * oneU,
                            height: (marquee.y2 - marquee.y1) * oneU,
                            background:
                                'color-mix(in oklch, var(--primary) 14%, transparent)',
                            border: '1px solid var(--primary)',
                            zIndex: 30,
                        }}
                    />
                )}
            </div>
        </div>
    )
}

/** A small square resize handle. */
function Handle({
    cursor,
    style,
    onDown,
}: {
    kind: string
    cursor: string
    style: React.CSSProperties
    onDown: (e: React.MouseEvent) => void
}): JSX.Element {
    return (
        <div
            onMouseDown={onDown}
            className="absolute rounded-[3px]"
            style={{
                width: 11,
                height: 11,
                background: 'var(--background)',
                border: '2px solid var(--primary)',
                cursor,
                zIndex: 6,
                ...style,
            }}
        />
    )
}
