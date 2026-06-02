// Pattern check: no GoF pattern (-) — rejected — presentational placeholder; the
// real geometry editor is a later phase, nothing to abstract yet.
//
// Premium scaffold. When the builder ships, it mounts a geometry editor over
// `ConfigKeymap.keyboard.{keys[],encoders[]}` — a board IS that geometry, so the
// builder edits the same config schema (no new model) and reuses the existing
// key-render path (src/firmware/labels.ts). This task only stubs the surface;
// reaching it already requires `usePremium()` upstream (BuilderCard).
import { Hammer } from 'lucide-react'
import { Modal } from '@/ui/modal'

interface KeyboardBuilderProps {
    opened: boolean
    onClose: () => void
}

export function KeyboardBuilder({
    opened,
    onClose,
}: KeyboardBuilderProps): JSX.Element {
    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Keyboard Builder"
            subtitle="Design a board from scratch"
            headerIcon={<Hammer />}
            customModalBoxClass="w-11/14 max-w-2xl"
            showFooter={false}
        >
            <div className="grid place-items-center gap-3 py-12 text-center">
                <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Hammer className="size-6" />
                </span>
                <div className="space-y-1">
                    <p className="text-sm font-semibold">Under construction</p>
                    <p className="mx-auto max-w-sm text-xs text-muted-foreground">
                        The builder will let you place keys and encoders to
                        define a custom board, editing the same{' '}
                        <span className="font-mono">keyboard</span> geometry the
                        rest of Remappr compiles from. Coming in a later
                        release.
                    </p>
                </div>
            </div>
        </Modal>
    )
}
