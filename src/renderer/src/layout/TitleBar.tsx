// pattern-check: skip — custom titlebar wired to window-control IPC, no abstraction
import { APP_VERSION } from '@/lib/constants'
import { getApi } from '@/electron/api'
import { WindowControls } from '@/layout/WindowControls'
import { TrafficLightInset } from '@/layout/TrafficLightInset'

export function TitleBar(): JSX.Element | null {
    const api = getApi()

    if (!api) return null

    return (
        <div
            className="relative z-[100] flex h-9 shrink-0 select-none items-center justify-between border-b bg-background text-xs"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            <TrafficLightInset />
            <div className="flex items-center gap-2 px-3">
                <span className="font-medium">Remappr</span>
                <span className="text-muted-foreground">v{APP_VERSION}</span>
            </div>
            {/* Shared min/max/close cluster (self-hides on macOS) — previously
                duplicated here with its own stale maximized read. */}
            <WindowControls />
        </div>
    )
}
