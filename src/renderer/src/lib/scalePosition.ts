export interface PhysicalLayoutPositionLocation {
    x: number
    y: number
    r?: number
    rx?: number
    ry?: number
}

export interface ScaledPositionStyle {
    top: number
    left: number
    transformOrigin: string
    transform: string
    willChange: 'transform'
}

export function scalePosition(
    { x, y, r, rx, ry }: PhysicalLayoutPositionLocation,
    oneU: number,
): ScaledPositionStyle {
    const left = x * oneU
    const top = y * oneU
    let transformOrigin = ''
    let transform = ''

    if (r) {
        const transformX = ((rx || x) - x) * oneU
        const transformY = ((ry || y) - y) * oneU
        transformOrigin = `${transformX}px ${transformY}px`
        transform = `rotate(${r}deg)`
    }

    return {
        top,
        left,
        transformOrigin,
        transform,
        willChange: 'transform',
    }
}
