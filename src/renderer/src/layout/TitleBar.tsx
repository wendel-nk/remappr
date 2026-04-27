// pattern-check: skip — custom titlebar wired to window-control IPC, no abstraction
import { useEffect, useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'
import { IpcChannels } from '../../../shared/ipc-types'
import { APP_VERSION } from '@/lib/constants'

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

export function TitleBar(): JSX.Element | null {
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

    if (!api) return null

    const isMac = platform === 'darwin'

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
            className="relative z-[100] flex h-9 shrink-0 select-none items-center justify-between border-b bg-background text-xs"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            <div
                className={`flex items-center gap-2 px-3 ${
                    isMac ? 'pl-20' : ''
                }`}
            >
                <span className="font-medium">Remappr</span>
                <span className="text-muted-foreground">v{APP_VERSION}</span>
            </div>
            {!isMac && (
                <div
                    className="flex h-full"
                    style={
                        { WebkitAppRegion: 'no-drag' } as React.CSSProperties
                    }
                >
                    <button
                        type="button"
                        onClick={onMin}
                        className="flex h-full w-12 items-center justify-center hover:bg-accent"
                        aria-label="Minimize"
                    >
                        <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={onMaxToggle}
                        className="flex h-full w-12 items-center justify-center hover:bg-accent"
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
                        className="flex h-full w-12 items-center justify-center hover:bg-destructive hover:text-destructive-foreground"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    )
}
