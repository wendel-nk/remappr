// Pattern check: no GoF pattern (-) — rejected — container wiring the new-board,
// geometry and hardware editors to configStore via existing hooks; state
// plumbing, no abstraction.
//
// The Keyboard Builder. Two modes share one modal:
//  • no config loaded → design a board FROM SCRATCH (NewBoardForm): a name +
//    rows×cols grid seeds `keyboard.keys` and a base layer (newBoardConfig).
//  • config loaded (created, connected, or imported) → edit it in two tabs:
//    Geometry (free-form per-key x/y/w/h/rotation, add/remove) and Hardware
//    (kscan wiring → a flashable ZMK overlay). Each tab saves through the
//    validator. See firmware/config/compilers/zmk.ts.
import { useState } from 'react'
import { Hammer } from 'lucide-react'
import { toast } from 'sonner'
import { serializeKeymap, type ConfigKeymap } from '@firmware/config'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import useConfigStore from '@/stores/configStore'
import { HardwareForm } from './HardwareForm'
import {
    draftToHardware,
    hardwareToDraft,
    type HardwareDraft,
} from './hardwareForm'
import { NewBoardForm } from './NewBoardForm'
import { GeometryEditor } from './GeometryEditor'
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

type Tab = 'geometry' | 'hardware'

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
    // Working geometry copy (edited locally until saved); falls back to the store
    // config when null (e.g. right after a board is created).
    const [geo, setGeo] = useState<ConfigKeymap | null>(null)
    const [tab, setTab] = useState<Tab>('geometry')
    const [error, setError] = useState<string | null>(null)

    // Re-seed editor state from the current config on the closed→open transition
    // (React's sanctioned alternative to a setState-in-effect).
    const [wasOpen, setWasOpen] = useState(opened)
    if (opened !== wasOpen) {
        setWasOpen(opened)
        if (opened) {
            setDraft(hardwareToDraft(config?.keyboard.hardware))
            setBoard(EMPTY_BOARD_DRAFT)
            setGeo(null)
            setTab('geometry')
            setError(null)
        }
    }

    const workingGeo = geo ?? config

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

    // Create the from-scratch board, then stay open so the user keeps editing.
    const createBoard = (): void => {
        commit(
            newBoardConfig({
                name: board.name,
                rows: clampDim(Number(board.rows)),
                cols: clampDim(Number(board.cols)),
                target: board.target,
            }),
            'Board created — now edit geometry + hardware',
        )
    }

    const save = (): void => {
        if (!config) {
            createBoard()
            return
        }
        if (tab === 'geometry') {
            if (workingGeo && commit(workingGeo, 'Geometry saved')) setGeo(null)
        } else if (
            commit(withHardware(config, draft), 'Board hardware saved')
        ) {
            // keep open so geometry + hardware can be set in one session
        }
    }

    const saveLabel = !config
        ? 'Create board'
        : tab === 'geometry'
          ? 'Save geometry'
          : 'Save hardware'

    const footer = (
        <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
                Close
            </Button>
            <Button onClick={save}>{saveLabel}</Button>
        </div>
    )

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Keyboard Builder"
            subtitle={
                config
                    ? 'Edit geometry and board hardware'
                    : 'Design a board from scratch'
            }
            headerIcon={<Hammer />}
            customModalBoxClass="w-11/14 max-w-2xl"
            footer={footer}
        >
            <div className="space-y-4">
                {config && workingGeo ? (
                    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
                        <TabsList>
                            <TabsTrigger value="geometry">Geometry</TabsTrigger>
                            <TabsTrigger value="hardware">Hardware</TabsTrigger>
                        </TabsList>
                        <TabsContent value="geometry" className="pt-4">
                            <GeometryEditor
                                value={workingGeo}
                                onChange={setGeo}
                            />
                        </TabsContent>
                        <TabsContent value="hardware" className="pt-4">
                            <HardwareForm
                                value={draft}
                                onChange={setDraft}
                                keyCount={workingGeo.keyboard.keys.length}
                            />
                        </TabsContent>
                    </Tabs>
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
