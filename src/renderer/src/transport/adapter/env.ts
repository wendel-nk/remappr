// pattern-check: skip — env detection helpers (Electron / web only)
export type Env = 'electron' | 'web'

export function isElectron(): boolean {
    return (
        typeof window.api !== 'undefined' &&
        typeof window.api?.invoke === 'function'
    )
}

export function detectEnv(): Env {
    return isElectron() ? 'electron' : 'web'
}
