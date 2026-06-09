// Pattern check: no GoF pattern (-) — rejected — static first-run tour step data
// plus pure step-index helpers; no abstraction or polymorphism warranted.
//
// Data substrate for the Keyboard Builder's first-run coachmark tour. Steps are
// kept as plain data (and the index math as pure functions) so the sequencing is
// unit-testable without rendering the React overlay. Each `selector` targets a
// `data-coach="…"` anchor in Builder; `selector: null` renders a
// centred card with a full-screen scrim (no spotlight).

export interface TourStep {
    /** CSS selector of the element to spotlight; null = centred card, no spotlight. */
    selector: string | null
    title: string
    body: string
    /**
     * When true, the start-chooser modal must stay open for this step (it is the
     * spotlight target). Advancing past it closes the modal so the rest of the
     * tour reads against the live builder.
     */
    requiresStartModal?: boolean
}

export const BUILDER_TOUR_STEPS: TourStep[] = [
    {
        selector: '.builder-start-modal',
        requiresStartModal: true,
        title: 'Welcome to the Builder',
        body: 'Start from a preset, import a KLE layout, or build a blank board — pick a starting point to begin (closing keeps the current board). This quick tour points out the essentials; hit Next to dive in.',
    },
    {
        selector: '[data-coach="builder-build-from"]',
        title: 'Start your board',
        body: 'You can also build from here any time — preset, KLE import, grid, or add keys one at a time. Geometry and matrix are shared across every layer.',
    },
    {
        selector: '[data-coach="builder-canvas"]',
        title: 'Place & arrange keys',
        body: 'Drag a key to move it, drag empty space to marquee-select, and use the selection handles to resize or rotate. Space/middle-drag pans, scroll zooms.',
    },
    {
        selector: '[data-coach="builder-layers"]',
        title: 'Layers',
        body: 'Switch, add, rename, and reorder layers here. Hover a layer to peek it on the board — bindings are per-layer, geometry is shared.',
    },
    {
        selector: '[data-coach="builder-matrix"]',
        title: 'Wire the matrix',
        body: 'Toggle matrix view to see and assign each key’s row/column. The matrix plus your board + pins is what makes the exported firmware actually flashable.',
    },
    {
        selector: '[data-coach="builder-inspector"]',
        title: 'Inspect & bind',
        body: 'Select a key to edit its geometry and matrix position, then pick an action — the picker shows only what your target firmware supports.',
    },
    {
        selector: '[data-coach="builder-export"]',
        title: 'Export & build',
        body: 'When you’re happy, export the Remappr config or compile it to ZMK/QMK — download a full project zip or push a cloud build straight to firmware.',
    },
]

/** Next step index, clamped to the last step (no wrap). */
export function nextTourStep(step: number, total: number): number {
    return Math.min(step + 1, total - 1)
}

/** Previous step index, clamped to the first step (no wrap). */
export function prevTourStep(step: number): number {
    return Math.max(0, step - 1)
}

/** Whether `step` is the final step of a `total`-length tour. */
export function isLastTourStep(step: number, total: number): boolean {
    return step >= total - 1
}
