// pattern-check: skip — device chip card + dropdown restyled to the redesign spec
import { useCallback, useState } from 'react'
import { RestoreStockModal } from './RestoreStockModal'
import useConnectionStore from '@/stores/connectionStore'
import undoRedoStore from '@/stores/undoRedoStore'
import { Power, Settings as SettingsIcon } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { Settings } from '@/components/modals/Settings'
import { toast } from 'sonner'

export const DeviceMenu = (): JSX.Element => {
    const { service, setService, communication, deviceName, disconnect } =
        useConnectionStore()
    const { reset } = undoRedoStore()
    const [settingsOpen, setSettingsOpen] = useState(false)

    const resetSettings = useCallback(async (): Promise<void> => {
        if (!service) return
        try {
            await service.resetSettings()
        } catch (e) {
            console.error('Failed to settings reset', e)
            toast.error('Failed to settings reset')
            return
        }

        reset()

        const currentService = service
        const currentCommunication = communication
        setService(null)

        setTimeout(() => {
            setService(currentService, currentCommunication ?? undefined)
        }, 0)
    }, [service, communication, reset, setService])

    const connected = !!deviceName
    const connLabel = communication === 'ble' ? 'BLE' : 'USB'

    return (
        <>
            {/* Device chip — card with status dot + name + connection, gear opens the menu. */}
            <DropdownMenu>
                <div className="flex items-center gap-2.5 rounded-[10px] border border-border bg-card px-2.5 py-2">
                    <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{
                            background: connected
                                ? 'oklch(0.72 0.16 152)'
                                : 'var(--muted-foreground)',
                            boxShadow: connected
                                ? '0 0 8px oklch(0.72 0.16 152)'
                                : 'none',
                        }}
                    />
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-semibold">
                            {deviceName || 'No Device Connected'}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground">
                            {connected ? `Connected · ${connLabel}` : 'Offline'}
                        </div>
                    </div>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            disabled={!connected}
                            aria-label="Device menu"
                            className="grid size-[26px] shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 data-[state=open]:bg-accent"
                        >
                            <SettingsIcon className="size-[15px]" />
                        </button>
                    </DropdownMenuTrigger>
                </div>

                <DropdownMenuContent
                    side="top"
                    align="end"
                    className="w-[220px]"
                >
                    <DropdownMenuItem
                        onClick={disconnect}
                        className="text-destructive focus:text-destructive"
                    >
                        <Power className="mr-2 h-4 w-4" />
                        Disconnect
                    </DropdownMenuItem>
                    <RestoreStockModal
                        onOk={(): void => {
                            resetSettings()
                        }}
                    />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={(): void => setSettingsOpen(true)}
                    >
                        <SettingsIcon className="mr-2 h-4 w-4" />
                        App settings
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Settings
                opened={settingsOpen}
                onClose={(): void => setSettingsOpen(false)}
            />
        </>
    )
}
