import { Children, useLayoutEffect, useMemo, useRef, useState } from 'react'

interface KeyLabelProps {
    children: React.ReactNode
    maxFontSize: number
    minFontSize?: number
    className?: string
    hoverZoom?: boolean
}

export const KeyLabel = ({
    children,
    maxFontSize,
    minFontSize = 4,
    className = '',
    hoverZoom,
}: KeyLabelProps): JSX.Element => {
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
