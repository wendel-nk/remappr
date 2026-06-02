// Pattern check: no GoF pattern (-) — rejected — presentational min/max/close buttons
// wired straight to the existing window-control IPC; extracted from TitleBar so the
// editor header and start page can both host them. No abstraction warranted.
import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'
import { IpcChannels } from '../../../shared/ipc-types'

interface ElectronWindow {
    api?: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
    }
    electron?: {
        process?: { platform?: string }
    }
}

function getApi(): ElectronWindow['api'] | undefined {
    return (window as unknown as ElectronWindow).api
}

function getPlatform(): string | undefined {
    return (window as unknown as ElectronWindow).electron?.process?.platform
}

/**
 * Native window min/max/close controls for the custom (frameless) Electron titlebar.
 * Renders nothing outside Electron or on macOS (which keeps its native traffic lights).
 * Buttons opt out of the drag region via WebkitAppRegion: 'no-drag'.
 */
export function WindowControls(): JSX.Element | null {
    const api = getApi()
    const platform = getPlatform()
    const [maximized, setMaximized] = useState(false)

    useEffect(() => {
        if (!api) return
        let cancelled = false
        api.invoke(IpcChannels.WINDOW_IS_MAXIMIZED).then((v) => {
            if (!cancelled) setMaximized(Boolean(v))
        })
        return () => {
            cancelled = true
        }
    }, [api])

    if (!api || platform === 'darwin') return null

    const onMin = (): void => {
        void api.invoke(IpcChannels.WINDOW_MINIMIZE)
    }
    const onMaxToggle = async (): Promise<void> => {
        const next = (await api.invoke(
            IpcChannels.WINDOW_MAXIMIZE_TOGGLE,
        )) as boolean
        setMaximized(next)
    }
    const onClose = (): void => {
        void api.invoke(IpcChannels.WINDOW_CLOSE)
    }

    return (
        <div
            className="flex h-full items-stretch"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
            <button
                type="button"
                onClick={onMin}
                className="flex h-full w-11 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Minimize"
            >
                <Minus className="h-3.5 w-3.5" />
            </button>
            <button
                type="button"
                onClick={onMaxToggle}
                className="flex h-full w-11 items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={maximized ? 'Restore' : 'Maximize'}
            >
                {maximized ? (
                    <Copy className="h-3.5 w-3.5 -scale-x-100" />
                ) : (
                    <Square className="h-3 w-3" />
                )}
            </button>
            <button
                type="button"
                onClick={onClose}
                className="flex h-full w-11 items-center justify-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                aria-label="Close"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    )
}
