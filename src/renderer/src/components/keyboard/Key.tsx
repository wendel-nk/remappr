// import './key.css';

import {
    PropsWithChildren,
    Children,
    CSSProperties,
    useRef,
    useState,
    useLayoutEffect,
    useMemo,
} from 'react'

export interface HoldTapLabels {
    tap: React.ReactNode
    hold: React.ReactNode
    tooltip?: string
}

interface KeyProps {
    selected?: boolean
    pressed?: boolean
    width: number
    height: number
    oneU: number // Button size
    hoverZoom?: boolean
    /**
     * Button contents
     */
    header?: string
    /**
     * When set, the key renders a two-section layout (tap on top, hold on bottom)
     * and the children/header are ignored.
     */
    holdTap?: HoldTapLabels
    /**
     * Optional click handler
     */
    onClick?: () => void
}

interface KeyDimension {
    width: number
    height: number
}

function makeSize(
    { width, height }: KeyDimension,
    oneU: number,
): CSSProperties {
    width *= oneU
    height *= oneU

    return {
        '--zmk-key-center-width': 'calc(' + width + 'px - 2px)',
        width: 'calc(' + width + 'px - 2px)',
        '--zmk-key-center-height': 'calc(' + height + 'px - 2px)',
        height: 'calc(' + height + 'px - 2px)',
    }
}

const FitText = ({
    children,
    maxFontSize,
    minFontSize = 4,
    className = '',
    hoverZoom,
}: {
    children: React.ReactNode
    maxFontSize: number
    minFontSize?: number
    className?: string
    hoverZoom?: boolean
}): JSX.Element => {
    const containerRef = useRef<HTMLDivElement>(null)
    const textRef = useRef<HTMLDivElement>(null)
    const [fontSize, setFontSize] = useState(minFontSize)

    const contentKey = useMemo(
        () =>
            Children.toArray(children)
                .map((c) =>
                    typeof c === 'string' || typeof c === 'number'
                        ? String(c)
                        : '',
                )
                .join('|'),
        [children],
    )

    useLayoutEffect(() => {
        let isSubscribed = true
        let rafHandle: number | null = null
        let pendingFrame = false

        const resizeText = (): void => {
            pendingFrame = false
            if (!isSubscribed) return

            const container = containerRef.current
            const text = textRef.current
            if (!container || !text) return

            const containerWidth = container.clientWidth
            const containerHeight = container.clientHeight
            if (containerWidth === 0 || containerHeight === 0) {
                // Retry once on next frame; ResizeObserver covers later changes.
                schedule()
                return
            }

            let low = minFontSize
            let high = maxFontSize
            let bestSize = minFontSize

            while (low <= high) {
                const mid = Math.floor((low + high) / 2)
                text.style.fontSize = `${mid}px`
                void text.offsetHeight

                const fitsWidth = text.scrollWidth <= containerWidth
                const fitsHeight = text.scrollHeight <= containerHeight

                if (fitsWidth && fitsHeight) {
                    bestSize = mid
                    low = mid + 1
                } else {
                    high = mid - 1
                }
            }

            if (isSubscribed) {
                setFontSize((prev) => (prev === bestSize ? prev : bestSize))
            }
        }

        const schedule = (): void => {
            if (pendingFrame) return
            pendingFrame = true
            rafHandle = requestAnimationFrame(resizeText)
        }

        schedule()

        let resizeObserver: ResizeObserver | null = null
        if (containerRef.current) {
            resizeObserver = new ResizeObserver(schedule)
            resizeObserver.observe(containerRef.current)
        }

        return (): void => {
            isSubscribed = false
            if (rafHandle !== null) cancelAnimationFrame(rafHandle)
            resizeObserver?.disconnect()
        }
    }, [contentKey, maxFontSize, minFontSize])

    return (
        <div
            ref={containerRef}
            data-zoomer={hoverZoom}
            className={`flex items-center justify-center w-full overflow-hidden p-[2px] ${className}`}
        >
            <div
                ref={textRef}
                className="text-center"
                style={
                    {
                        fontSize: `${fontSize}px`,
                        lineHeight: '1.15',
                        whiteSpace: 'normal',
                        wordBreak: 'keep-all',
                        overflowWrap: 'normal',
                        hyphens: 'none',
                        width: '100%',
                    } as React.CSSProperties
                }
            >
                {children}
            </div>
        </div>
    )
}

export const Key = ({
    selected = false,
    pressed = false,
    header,
    oneU,
    hoverZoom = true,
    holdTap,
    ...props
}: PropsWithChildren<KeyProps>): JSX.Element => {
    const size = makeSize(props, oneU)
    const maxChildFontSize = Math.max(10, oneU / 2.5)
    const maxHoldFontSize = Math.max(8, oneU / 4)
    const maxHeaderFontSize = Math.max(6, oneU / 6)

    const children = Children.map(
        props.children,
        (c): React.ReactElement => (
            <FitText
                maxFontSize={maxChildFontSize}
                minFontSize={4}
                className="font-keycap flex-1"
                hoverZoom={hoverZoom}
            >
                {c}
            </FitText>
        ),
    )

    return (
        <div
            className="group inline-flex box-border b-0 flex-col justify-items-center justify-content-center items-center transition-all duration-0 hover:scale-150 border border-transparent hover:border-border rounded-md"
            data-zoomer={hoverZoom}
            style={size as React.CSSProperties}
            {...props}
        >
            <button
                aria-selected={selected}
                data-zoomer={hoverZoom}
                title={holdTap?.tooltip}
                className={`rounded${
                    oneU > 20 ? '-md' : ''
                } transition-all duration-100 box-border text-base-content bg-cyan-950  aria-selected:bg-primary aria-selected:text-primary-content grow
                 flex-col flex items-center ${holdTap ? 'justify-stretch' : 'justify-evenly'} w-full h-full overflow-hidden ${
                     pressed ? 'bg-green-600 text-white shadow-lg scale-95' : ''
                 }`}
            >
                {holdTap ? (
                    <>
                        {header && (
                            <div className="key-header-section flex items-center justify-center w-full h-[20%] overflow-hidden">
                                <FitText
                                    maxFontSize={maxHeaderFontSize}
                                    minFontSize={4}
                                    hoverZoom={hoverZoom}
                                >
                                    {header}
                                </FitText>
                            </div>
                        )}
                        <div className="key-tap-section flex items-center justify-center w-full flex-1 overflow-hidden border-b border-border/40">
                            <FitText
                                maxFontSize={maxChildFontSize}
                                minFontSize={4}
                                hoverZoom={hoverZoom}
                                className="font-keycap"
                            >
                                {holdTap.tap}
                            </FitText>
                        </div>
                        <div className="key-hold-section flex items-center justify-center w-full h-[35%] overflow-hidden bg-muted/40 text-muted-foreground">
                            <FitText
                                maxFontSize={maxHoldFontSize}
                                minFontSize={4}
                                hoverZoom={hoverZoom}
                                className="font-keycap"
                            >
                                {holdTap.hold}
                            </FitText>
                        </div>
                    </>
                ) : (
                    <>
                        {header && (
                            <FitText
                                maxFontSize={maxHeaderFontSize}
                                minFontSize={4}
                                hoverZoom={hoverZoom}
                                className={'flex-none'}
                            >
                                {header}
                            </FitText>
                        )}
                        {children}
                    </>
                )}
            </button>
        </div>
    )
}
