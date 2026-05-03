// pattern-check: skip — single pure clamp helper, no abstraction warranted
export function clampInt(value: number, lo: number, hi: number): number {
    if (!Number.isFinite(value)) return lo
    return Math.max(lo, Math.min(hi, Math.trunc(value)))
}

export function parseIntSafe(input: string, fallback = 0): number {
    const n = parseInt(input, 10)
    return Number.isFinite(n) ? n : fallback
}
