// pattern-check: skip — single pure clamp helper, no abstraction warranted
export function clampInt(value: number, lo: number, hi: number): number {
    if (!Number.isFinite(value)) return lo
    return Math.max(lo, Math.min(hi, Math.trunc(value)))
}

export function parseIntSafe(input: string, fallback = 0): number {
    const n = parseInt(input, 10)
    return Number.isFinite(n) ? n : fallback
}

// pattern-check: skip pure numeric helpers consolidated from duplicated inline copies
/** Clamp a float to [lo, hi] without truncating (cf. clampInt). */
export function clamp(value: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, value))
}

/** Round to 3 decimal places (geometry units). */
export function round3(v: number): number {
    return Math.round(v * 1000) / 1000
}
