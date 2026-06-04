// Pattern check: no GoF pattern (-) — rejected — localStorage CRUD helpers plus
// a list UI; thin persistence + presentational glue, no abstraction warranted.
//
// The builder's keyboard library, ported from the prototype (BuilderStore.jsx
// loadBoards/saveBoardToLibrary/deleteBoardFromLibrary). Boards persist as
// serialized Remappr configs under localStorage `remappr.boards`, so a designed
// board can be saved, reopened, or removed without a backend. Loading a board
// routes through configStore.loadFromSource (parse + validate in one place).
import { useMemo, useState } from 'react'
import { Layers, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import useConfigStore from '@/stores/configStore'
import {
    type BoardEntry,
    deleteBoard,
    loadBoards,
    saveBoard,
} from './builderLibrary'

interface LibraryModalProps {
    open: boolean
    onClose: () => void
}

export function LibraryModal({
    open,
    onClose,
}: LibraryModalProps): JSX.Element {
    const config = useConfigStore((s) => s.config)
    const loadFromSource = useConfigStore((s) => s.loadFromSource)
    // Derive the list from localStorage, re-read whenever the modal (re)opens —
    // the toolbar Save writes the library from outside this component, so a
    // mount-time read would go stale — or after an in-modal mutation bumps `rev`.
    const [rev, setRev] = useState(0)
    const boards = useMemo<BoardEntry[]>(
        () => loadBoards(),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [open, rev],
    )

    const handleSave = (): void => {
        if (!config) return
        saveBoard(config)
        setRev((r) => r + 1)
        toast.success(`Saved "${config.meta.name}" to your library`)
    }

    const handleLoad = (entry: BoardEntry): void => {
        if (loadFromSource(entry.source)) {
            toast.success(`Loaded "${entry.name}"`)
            onClose()
        } else {
            toast.error('Failed to load — the saved board is invalid')
        }
    }

    const handleDelete = (entry: BoardEntry): void => {
        deleteBoard(entry.id)
        setRev((r) => r + 1)
        toast.success(`Removed "${entry.name}"`)
    }

    const fmtDate = (ms: number): string =>
        new Date(ms).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })

    return (
        <Modal
            opened={open}
            onClose={onClose}
            title="Keyboard library"
            subtitle="Saved boards on this machine"
            headerIcon={<Layers />}
            customModalBoxClass="w-11/14 max-w-lg"
            showFooter={false}
        >
            <div className="space-y-4">
                <Button
                    onClick={handleSave}
                    disabled={!config}
                    className="flex w-full items-center justify-center gap-2"
                >
                    <Plus className="size-4" /> Save current board
                </Button>

                {boards.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        No saved boards yet. Design a keyboard, then save it
                        here to reopen it later.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {boards.map((b) => (
                            <li
                                key={b.id}
                                className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-[13px] font-semibold">
                                        {b.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {b.keys} key{b.keys === 1 ? '' : 's'} ·{' '}
                                        {fmtDate(b.savedAt)}
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleLoad(b)}
                                >
                                    Load
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label={`Delete ${b.name}`}
                                    onClick={() => handleDelete(b)}
                                >
                                    <Trash2 className="size-4 text-muted-foreground" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Modal>
    )
}
