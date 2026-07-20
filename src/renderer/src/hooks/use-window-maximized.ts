// Pattern check: no GoF pattern (-) — rejected — thin state hook re-querying
// window state over existing IPC; no abstraction warranted.
import { useEffect, useState } from 'react'
import { IpcChannels } from '../../../shared/ipc-types'
import { getApi } from '@/electron/api'

/**
 * Tracks the Electron window's maximized state. Re-queries on every `resize`
 * so OS-side maximize/restore (titlebar double-click, window snap) updates the
 * restore/maximize icon too — a mount-time read alone goes stale.
 * Always false outside Electron.
 */
export function useWindowMaximized(): boolean {
    const api = getApi()
    const [maximized, setMaximized] = useState(false)

    useEffect(() => {
        if (!api) return
        let cancelled = false
        const query = (): void => {
            void api.invoke(IpcChannels.WINDOW_IS_MAXIMIZED).then((v) => {
                if (!cancelled) setMaximized(Boolean(v))
            })
        }
        query()
        window.addEventListener('resize', query)
        return () => {
            cancelled = true
            window.removeEventListener('resize', query)
        }
    }, [api])

    return maximized
}
