// pattern-check: skip — extract right-dock conditional JSX into a props-driven presentational component, no abstraction
// The right dock, extracted verbatim from Builder.tsx: the JSON config editor
// (480px) whenever jsonOpen, else the inspector (296px) but only while a key is
// selected — otherwise nothing, so the canvas widens. Pure presentation over the
// existing JsonConfigPanel / BuilderInspector.
import { SlidersHorizontal } from 'lucide-react'
import { JsonConfigPanel } from './JsonConfigPanel'
import { BuilderInspector } from './BuilderInspector'

export interface BuilderRightDockProps {
    jsonOpen: boolean
    setJsonOpen: (open: boolean) => void
    selectionSize: number
}

export function BuilderRightDock({
    jsonOpen,
    setJsonOpen,
    selectionSize,
}: BuilderRightDockProps): JSX.Element | null {
    return jsonOpen ? (
        <aside className="flex w-[480px] shrink-0 flex-col border-l border-border bg-sidebar">
            <JsonConfigPanel onClose={() => setJsonOpen(false)} />
        </aside>
    ) : selectionSize > 0 ? (
        <aside
            className="flex w-[296px] shrink-0 flex-col overflow-y-auto border-l border-border bg-sidebar"
            data-coach="builder-inspector"
        >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <SlidersHorizontal size={15} className="text-primary" />
                <span className="text-[13px] font-bold">Inspector</span>
            </div>
            <BuilderInspector />
        </aside>
    ) : null
}
