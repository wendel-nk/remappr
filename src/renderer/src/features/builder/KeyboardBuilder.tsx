// Pattern check: no GoF pattern (-) — rejected — container wiring the new-board
// and hardware forms to configStore via existing hooks; state plumbing, no
// abstraction.
//
// The Keyboard Builder. Two modes share one modal:
//  • no config loaded → design a board FROM SCRATCH (NewBoardForm): a name +
//    rows×cols grid seeds `keyboard.keys` and a base layer (newBoardConfig).
//  • config loaded (just-created, connected, or imported) → define its BOARD
//    HARDWARE (HardwareForm): kscan wiring so the ZMK compiler emits a flashable
//    overlay (real kscan + chosen + matrix-transform) instead of the
//    geometry-derived scaffold — see firmware/config/compilers/zmk.ts.
// Free-form per-key drag/resize + an RC() transform editor are later phases.
import { useState } from 'react'
import { Hammer } from 'lucide-react'
import { toast } from 'sonner'
import { serializeKeymap, type ConfigKeymap } from '@firmware/config'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import useConfigStore from '@/stores/configStore'
import { HardwareForm } from './HardwareForm'
import {
    draftToHardware,
    hardwareToDraft,
    type HardwareDraft,
} from './hardwareForm'
import { NewBoardForm } from './NewBoardForm'
import {
    clampDim,
    newBoardConfig,
    EMPTY_BOARD_DRAFT,
    type NewBoardDraft,
} from './geometryEditor'

interface KeyboardBuilderProps {
    opened: boolean
    onClose: () => void
}

// Drop the hardware key, then re-add it only when the draft produced one — so a
// cleared form removes the block instead of leaving a stale one.
function withHardware(
    config: ConfigKeymap,
    draft: HardwareDraft,
): ConfigKeymap {
    const hw = draftToHardware(draft, config.keyboard.hardware?.transform)
    const keyboard = { ...config.keyboard }
    delete keyboard.hardware
    if (hw) keyboard.hardware = hw
    return { ...config, keyboard }
}

export function KeyboardBuilder({
    opened,
    onClose,
}: KeyboardBuilderProps): JSX.Element {
    const config = useConfigStore((s) => s.config)
    const loadFromSource = useConfigStore((s) => s.loadFromSource)
    const [draft, setDraft] = useState<HardwareDraft>(() =>
        hardwareToDraft(config?.keyboard.hardware),
    )
    const [board, setBoard] = useState<NewBoardDraft>(EMPTY_BOARD_DRAFT)
    const [error, setError] = useState<string | null>(null)

    // Re-seed both drafts from the current config on the closed→open transition,
    // adjusting state during render (React's sanctioned alternative to a
    // setState-in-effect) so a stale draft never flashes when the modal reopens.
    const [wasOpen, setWasOpen] = useState(opened)
    if (opened !== wasOpen) {
        setWasOpen(opened)
        if (opened) {
            setDraft(hardwareToDraft(config?.keyboard.hardware))
            setBoard(EMPTY_BOARD_DRAFT)
            setError(null)
        }
    }

    // Round-trip through the validator so the schema's cross-checks gate the write.
    const commit = (next: ConfigKeymap, ok: string): boolean => {
        if (loadFromSource(serializeKeymap(next))) {
            setError(null)
            toast.success(ok)
            return true
        }
        setError(useConfigStore.getState().error)
        return false
    }

    const saveHardware = (): void => {
        if (!config) return
        if (commit(withHardware(config, draft), 'Board hardware saved'))
            onClose()
    }

    // Create the from-scratch board, then stay open so the user flows straight
    // into defining its hardware (config is now non-null → the hardware panel).
    const createBoard = (): void => {
        commit(
            newBoardConfig({
                name: board.name,
                rows: clampDim(Number(board.rows)),
                cols: clampDim(Number(board.cols)),
                target: board.target,
            }),
            'Board created — now define its hardware',
        )
    }

    const footer = (
        <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
                {config ? 'Cancel' : 'Close'}
            </Button>
            {config ? (
                <Button onClick={saveHardware}>Save hardware</Button>
            ) : (
                <Button onClick={createBoard}>Create board</Button>
            )}
        </div>
    )

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Keyboard Builder"
            subtitle={
                config
                    ? 'Define the board hardware for a flashable export'
                    : 'Design a board from scratch'
            }
            headerIcon={<Hammer />}
            customModalBoxClass="w-11/14 max-w-2xl"
            footer={footer}
        >
            <div className="space-y-4">
                {config ? (
                    <HardwareForm
                        value={draft}
                        onChange={setDraft}
                        keyCount={config.keyboard.keys.length}
                    />
                ) : (
                    <>
                        <NewBoardForm value={board} onChange={setBoard} />
                        <p className="text-xs text-muted-foreground">
                            Or connect a keyboard / import a keymap to edit an
                            existing board instead.
                        </p>
                    </>
                )}
                {error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {error}
                    </p>
                )}
            </div>
        </Modal>
    )
}
