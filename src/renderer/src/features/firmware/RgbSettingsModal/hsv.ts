// pattern-check: skip — pure helpers for hex bytes + HSV/RGB conversions
import type { HsvColor } from '@firmware/service'

export function bytesToHex(buf: Uint8Array): string {
    return Array.from(buf)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ')
}

export function hexToBytes(text: string): Uint8Array | null {
    const tokens = text
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
    const out = new Uint8Array(tokens.length)
    for (let i = 0; i < tokens.length; i++) {
        const v = parseInt(tokens[i], 16)
        if (!Number.isFinite(v) || v < 0 || v > 0xff) return null
        out[i] = v
    }
    return out
}

export interface Rgb {
    r: number
    g: number
    b: number
}

// HSV (each 0..255 per Keychron wire format) → RGB (each 0..255).
export function hsvToRgb({ h, s, v }: HsvColor): Rgb {
    const hh = (h / 255) * 6
    const ss = s / 255
    const vv = v / 255
    const i = Math.floor(hh) % 6
    const f = hh - Math.floor(hh)
    const p = vv * (1 - ss)
    const q = vv * (1 - f * ss)
    const t = vv * (1 - (1 - f) * ss)
    let r = 0,
        g = 0,
        b = 0
    if (i === 0) [r, g, b] = [vv, t, p]
    else if (i === 1) [r, g, b] = [q, vv, p]
    else if (i === 2) [r, g, b] = [p, vv, t]
    else if (i === 3) [r, g, b] = [p, q, vv]
    else if (i === 4) [r, g, b] = [t, p, vv]
    else [r, g, b] = [vv, p, q]
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    }
}

export function hsvToCss(c: HsvColor): string {
    const { r, g, b } = hsvToRgb(c)
    return `rgb(${r},${g},${b})`
}

export function hsvToHex(c: HsvColor): string {
    const { r, g, b } = hsvToRgb(c)
    const h = (n: number): string => n.toString(16).padStart(2, '0')
    return `#${h(r)}${h(g)}${h(b)}`
}

// RGB (each 0..255) → HsvColor (each 0..255 per Keychron wire format).
export function rgbToHsv({ r, g, b }: Rgb): HsvColor {
    const rr = r / 255
    const gg = g / 255
    const bb = b / 255
    const max = Math.max(rr, gg, bb)
    const min = Math.min(rr, gg, bb)
    const d = max - min
    const v = max
    const s = max === 0 ? 0 : d / max
    let h = 0
    if (d !== 0) {
        if (max === rr) h = ((gg - bb) / d) % 6
        else if (max === gg) h = (bb - rr) / d + 2
        else h = (rr - gg) / d + 4
        h *= 60
        if (h < 0) h += 360
    }
    return {
        h: Math.round((h / 360) * 255),
        s: Math.round(s * 255),
        v: Math.round(v * 255),
    }
}

// #rrggbb → HsvColor (each 0..255 per Keychron wire format). Returns null on parse error.
export function hexToHsv(hex: string): HsvColor | null {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
    if (!m) return null
    const n = parseInt(m[1], 16)
    return rgbToHsv({ r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff })
}
