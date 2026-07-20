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
// pattern-check: skip — variant prop on the existing presentational spacer
interface TrafficLightInsetProps {
    /**
     * `row` (default) — horizontal spacer for a header bar the lights overlap
     * from the left. `block` — vertical spacer for a full-height column that
     * occupies the window's top-left corner (the editor sidebar): there the
     * lights overlap from the top, so the clearance is height, not width.
     */
    variant?: 'row' | 'block'
}

export function TrafficLightInset({
    variant = 'row',
}: TrafficLightInsetProps): JSX.Element | null {
    const api = getApi()
    const platform = getPlatform()

    if (!api || platform !== 'darwin') return null

    // row: 12px offset + three 12px buttons + two 8px gaps ≈ 64px, plus a
    // small gap before the header's own content.
    // block: lights sit at y≈10..22 — 36px clears them with a little air.
    return variant === 'row' ? (
        <div aria-hidden className="h-full w-[68px] shrink-0" />
    ) : (
        <div aria-hidden className="h-9 w-full shrink-0" />
    )
}
