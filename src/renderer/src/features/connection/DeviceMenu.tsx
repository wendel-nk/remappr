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
import { isUnlocked } from '@firmware'

export const DeviceMenu = (): JSX.Element => {
    const {
        service,
        setService,
        communication,
        deviceName,
        lockState,
        disconnect,
    } = useConnectionStore()
    const { reset } = undoRedoStore()

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

    const isDisabled = !deviceName || !isUnlocked(lockState)

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
