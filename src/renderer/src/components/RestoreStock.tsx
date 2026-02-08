import { useState } from 'react'
import { Modal } from '@/components/ui/Modal.tsx'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu.tsx'
import { RotateCcw } from 'lucide-react'

interface RestoreStockSettings {
    onOk: () => void
}

export function RestoreStock(props: RestoreStockSettings): JSX.Element {
    const [showModal, setShowModal] = useState(false)

    const handleClick = (): void => {
        setShowModal(true)
    }

    const handleOk = (): void => {
        props.onOk()
        setShowModal(false)
    }

    const handleClose = (): void => {
        setShowModal(false)
    }

    return (
        <>
            <DropdownMenuItem
                onSelect={(e): void => e.preventDefault()}
                onClick={handleClick}
            >
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore Stock Settings
            </DropdownMenuItem>

            <Modal
                opened={showModal}
                onClose={handleClose}
                onOk={handleOk}
                customModalBoxClass="w-11/12 max-w-5xl"
                success="Restore Stock Settings"
                close="Cancel"
                title="Restore Stock Settings"
                description="Settings reset will remove any customizations previously made in Remappr and restore the stock keymap. Continue?"
                showFooter={true}
                xButton={true}
                type="text"
            />
        </>
    )
}
