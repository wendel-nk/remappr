// pattern-check: skip — thin IPC event subscriber + toast trigger
import { useEffect } from 'react'
import { toast } from 'sonner'
import {
    IpcEvents,
    type UpdateAvailablePayload,
} from '../../../shared/ipc-types'

const DISMISS_KEY_PREFIX = 'remappr:dismissed-update:'

interface ElectronWindow {
    api?: {
        on: (event: string, cb: (...args: unknown[]) => void) => () => void
    }
}

function getApi(): ElectronWindow['api'] | undefined {
    return (window as unknown as ElectronWindow).api
}

function parseSemver(v: string): [number, number, number] | null {
    const m = v.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/)
    if (!m) return null
    return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function isOlderOrEqual(a: string, b: string): boolean {
    const x = parseSemver(a)
    const y = parseSemver(b)
    if (!x || !y) return false
    for (let i = 0; i < 3; i++) {
        if (x[i] < y[i]) return true
        if (x[i] > y[i]) return false
    }
    return true
}

function pruneStaleDismissKeys(currentLatest: string): void {
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (!key || !key.startsWith(DISMISS_KEY_PREFIX)) continue
        const ver = key.slice(DISMISS_KEY_PREFIX.length)
        if (ver === currentLatest) continue
        if (isOlderOrEqual(ver, currentLatest)) {
            localStorage.removeItem(key)
        }
    }
}

export function UpdateNotification(): null {
    useEffect(() => {
        const api = getApi()
        if (!api) return

        const unsubscribe = api.on(IpcEvents.UPDATE_AVAILABLE, (...args) => {
            const payload = args[0] as UpdateAvailablePayload | undefined
            if (!payload) return

            pruneStaleDismissKeys(payload.version)

            const dismissKey = `${DISMISS_KEY_PREFIX}${payload.version}`
            if (localStorage.getItem(dismissKey) === '1') return

            toast(`Version v${payload.version} is available`, {
                description: 'A newer Remappr release is available.',
                duration: Infinity,
                action: {
                    label: 'Download',
                    onClick: () => window.open(payload.url, '_blank'),
                },
                cancel: {
                    label: 'Dismiss',
                    onClick: () => {
                        localStorage.setItem(dismissKey, '1')
                    },
                },
            })
        })

        return unsubscribe
    }, [])

    return null
}
