import { useCallback } from 'react'
import { RestoreStockModal } from './RestoreStockModal'
import useConnectionStore from '@/stores/connectionStore'
import undoRedoStore from '@/stores/undoRedoStore'
import { Button } from '@/ui/button'
import { Settings, Power } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuItem } from '@/ui/sidebar'
import { toast } from 'sonner'
import { callRpc } from '@firmware/zmk/rpc/rpcCall'

export const DeviceMenu = (): JSX.Element => {
    const { connection, setConnection, deviceName, lockState, disconnect } =
        useConnectionStore()
    const { reset } = undoRedoStore()

    const resetSettings = useCallback(async (): Promise<void> => {
        const resp = await callRpc({
            core: { resetSettings: true },
        })

        if (!resp.core?.resetSettings) {
            console.error('Failed to settings reset', resp)
            toast.error('Failed to settings reset')
            return
        }

        reset()

        const currentConnection = connection
        setConnection(null)

        setTimeout(() => {
            setConnection(currentConnection)
        }, 0)
    }, [connection, reset, setConnection])

    const isDisabled = !deviceName || lockState !== 'unlocked'

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="w-full justify-between"
                            disabled={isDisabled}
                        >
                            <span className="truncate">
                                {deviceName || 'No Device Connected'}
                            </span>
                            <Settings className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent>
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
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
