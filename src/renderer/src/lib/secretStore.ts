// pattern-check: skip — thin async secret accessor choosing the Electron
// safeStorage IPC backend or a localStorage fallback; glue, no abstraction.
//
// Renderer-side secret access. In Electron it routes to the main process's
// safeStorage-backed store (OS-encrypted, on disk) via the IPC bridge; on the
// web (or if the bridge/encryption is unavailable) it falls back to
// localStorage so the feature still works, just without OS encryption. Used for
// the GitHub build token so it no longer sits in plain localStorage on desktop.
import { IpcChannels } from '@shared/ipc-types'

/** localStorage key prefix for the web fallback. */
const PREFIX = 'remappr.secret.'

/** The GitHub cloud-build personal access token. */
export const GITHUB_TOKEN_KEY = 'githubToken'

interface IpcBridge {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>
}

/** The Electron IPC bridge if running under Electron with it exposed. */
function bridge(): IpcBridge | null {
    const api = (globalThis as { api?: IpcBridge }).api
    return api && typeof api.invoke === 'function' ? api : null
}

export async function getSecret(key: string): Promise<string> {
    const api = bridge()
    if (api) {
        try {
            const v = await api.invoke(IpcChannels.SECRET_GET, { key })
            if (typeof v === 'string') return v
            // null = not stored (or encryption unavailable) → fall through to
            // the web store so a previously-saved fallback value still loads.
        } catch {
            /* fall through to localStorage */
        }
    }
    try {
        return localStorage.getItem(PREFIX + key) ?? ''
    } catch {
        return ''
    }
}

export async function setSecret(key: string, value: string): Promise<void> {
    const api = bridge()
    if (api) {
        try {
            const channel = value
                ? IpcChannels.SECRET_SET
                : IpcChannels.SECRET_DELETE
            const ok = await api.invoke(
                channel,
                value ? { key, value } : { key },
            )
            if (ok === true) {
                // Encrypted store owns it now — clear any stale web fallback.
                try {
                    localStorage.removeItem(PREFIX + key)
                } catch {
                    /* ignore */
                }
                return
            }
        } catch {
            /* fall through to localStorage */
        }
    }
    try {
        if (value) localStorage.setItem(PREFIX + key, value)
        else localStorage.removeItem(PREFIX + key)
    } catch {
        /* storage unavailable — non-fatal */
    }
}
