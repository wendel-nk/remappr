// Pattern check: no GoF pattern (-) — rejected — env detection helpers, no abstraction
export type Env = 'tauri' | 'electron' | 'web'

declare global {
    interface Window {
        __TAURI_INTERNALS__?: object
    }
}

export function isElectron (): boolean {
    return (
        typeof window.api !== 'undefined' &&
        typeof window.api?.invoke === 'function'
    )
}

export function isTauri (): boolean {
    return !!window.__TAURI_INTERNALS__
}

export function detectEnv (): Env {
    return isTauri() ? 'tauri' : isElectron() ? 'electron' : 'web'
}
