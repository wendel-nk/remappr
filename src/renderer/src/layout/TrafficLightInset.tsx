// Pattern check: no GoF pattern (-) — rejected — presentational spacer keyed on
// the host platform, the left-hand counterpart of WindowControls. No abstraction.
import { getApi, getPlatform } from '@/electron/api'

/**
 * Reserves the top-left strip that macOS paints its native traffic lights over.
 *
 * The main process gives macOS `titleBarStyle: 'hiddenInset'` +
 * `trafficLightPosition: { x: 12, y: 10 }` (see src/main/index.ts), so the
 * close/minimize/zoom buttons float ON TOP of whatever the renderer draws in
 * that corner. Every custom header therefore has to start its own content to
 * the right of them — without this, the sidebar toggle and brand sit under the
 * buttons and can't be clicked.
 *
 * Renders nothing outside Electron and on Windows/Linux, where the same corner
 * is free and {@link WindowControls} handles the buttons on the right instead.
 */
export function TrafficLightInset(): JSX.Element | null {
    const api = getApi()
    const platform = getPlatform()

    if (!api || platform !== 'darwin') return null

    // 12px offset + three 12px buttons + two 8px gaps ≈ 64px, plus a small gap
    // before the header's own content.
    return <div aria-hidden className="h-full w-[68px] shrink-0" />
}
