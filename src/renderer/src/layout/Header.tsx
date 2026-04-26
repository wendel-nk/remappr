/* eslint-disable react-hooks/preserve-manual-memoization */
import { useCallback, useEffect } from 'react'
import { useEmitter } from '@/hooks/use-pub-sub'
import { LockState } from '@zmkfirmware/zmk-studio-ts-client/core'
import { Redo2, Save, Trash2, Undo2 } from 'lucide-react'
import useConnectionStore from '@/stores/connectionStore'
import undoRedoStore from '@/stores/undoRedoStore'
import { Settings } from '../components/modals/Settings.tsx'
import { Download as DownloadModal } from '../components/modals/Download.tsx'
import { SidebarTrigger } from '@/ui/sidebar.tsx'
import { Button } from '@/ui/button.tsx'
import { Separator } from '@/ui/separator.tsx'
import { useConnectedDeviceData } from '@/features/connection/rpcConnectionService.ts'
import { toast } from 'sonner'
import { callRemoteProcedureControl } from '@/features/connection/callRemoteProcedureControl.ts'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/ui/tooltip.tsx'

export function Header(): JSX.Element {
    const { connection, lockState, setConnection } = useConnectionStore()
    const { undo, redo, canUndo, canRedo, reset } = undoRedoStore()
    const { subscribe } = useEmitter()

    const [unsaved, setUnsaved] = useConnectedDeviceData<boolean>(
        { keymap: { checkUnsavedChanges: true } },
        (request) => request.keymap?.checkUnsavedChanges,
    )

    useEffect(() => {
        console.log(unsaved)
        return subscribe(
            'rpc_notification.keymap.unsavedChangesStatusChanged',
            (data: unknown): void => {
                const ls = data as boolean
                console.log(ls)
                setUnsaved(ls)
            },
        )
    }, [setUnsaved, subscribe, unsaved])

    const save = useCallback(async (): Promise<void> => {
        const resp = await callRemoteProcedureControl({
            keymap: { saveChanges: true },
        })

        if (!resp.keymap?.saveChanges || resp.keymap?.saveChanges.err) {
            console.error('Failed to save changes', resp.keymap?.saveChanges)
            toast.error(`Failed to save changes`)
        }
    }, [])

    const discard = useCallback(async (): Promise<void> => {
        const resp = await callRemoteProcedureControl({
            keymap: { discardChanges: true },
        })

        if (!resp.keymap?.discardChanges) {
            console.error('Failed to discard changes', resp)
            toast.error(`Failed to discard changes`)
        }

        reset()
        setConnection(connection)
    }, [connection, reset, setConnection])

    return (
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
                <SidebarTrigger className="-ml-1" />
                <Separator
                    orientation="vertical"
                    className="mx-2 data-[orientation=vertical]:h-4"
                />
                <img
                    src="/remappr.webp"
                    alt="Remappr Logo"
                    className="h-8 rounded ps-3"
                />{' '}
                <span className="px-3">Remappr</span>
                <div className="ml-auto flex items-center gap-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <DownloadModal />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Download Config</p>
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <Settings />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Settings</p>
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={!canUndo()}
                                    onClick={undo}
                                >
                                    <Undo2 aria-label="Undo" />
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Undo</p>
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={!canRedo()}
                                    onClick={redo}
                                >
                                    <Redo2 aria-label="Redo" />
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Redo</p>
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={
                                        !unsaved ||
                                        !connection ||
                                        lockState !==
                                            LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED
                                    }
                                    onClick={save}
                                >
                                    <Save aria-label="Save" />
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Save</p>
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={!unsaved}
                                    onClick={discard}
                                >
                                    <Trash2 aria-label="Discard" />
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Discard</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </header>
    )
}
