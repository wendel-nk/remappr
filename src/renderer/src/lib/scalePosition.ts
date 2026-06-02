export interface PhysicalLayoutPositionLocation {
    x: number
    y: number
    r?: number
    rx?: number
    ry?: number
}

// pattern-check: skip — removing a layer-promoting field from an existing interface
export interface ScaledPositionStyle {
    top: number
    left: number
    transformOrigin: string
    transform: string
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
    }
}
