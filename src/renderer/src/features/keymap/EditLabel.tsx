import { useState } from 'react'
import { Modal } from '@/ui/modal.tsx'
import { Input } from '@/ui/input.tsx'

interface EditLabelData {
    id: number
    name: string
    newName?: string | null
}

export interface EditLabelProps {
    editLabelData?: EditLabelData
    onClose?: () => void
    handleSaveNewLabel?: (
        id: number,
        oldName: string,
        newName: string | null,
    ) => void
}

export default function EditLabel(props: EditLabelProps): JSX.Element | null {
    const [newLabelName, setNewLabelName] = useState(
        props.editLabelData?.name ?? '',
    )

    if (!props.editLabelData || !props.handleSaveNewLabel) {
        return null
    }

    const { editLabelData, handleSaveNewLabel } = props

    function handleSave(): void {
        handleSaveNewLabel(editLabelData.id, editLabelData.name, newLabelName)
    }

    return (
        <Modal
            success="Update"
            onOk={handleSave}
            onClose={props.onClose}
            customModalBoxClass="w-11/14 max-w-2xl"
            text="Rename"
            type="text"
        >
            <h2 className="mb-3 text-lg">New Layer Name</h2>
            <Input
                type="text"
                placeholder="Type here"
                className="input input-bordered w-full max-w-xs"
                defaultValue={editLabelData.name}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- modal opens specifically to rename; focus expected.
                autoFocus
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        handleSave()
                    }
                }}
            />
            {/*<input*/}
            {/*	type="text" placeholder="Type here" className="input input-bordered w-full max-w-xs"*/}
            {/*	defaultValue={ props.editLabelData.name }*/}
            {/*	autoFocus*/}
            {/*	onChange={ ( e ) => setNewLabelName( e.target.value ) }*/}
            {/*	onKeyDown={ ( e ) => {*/}
            {/*		if ( e.key === "Enter" ) {*/}
            {/*			handleSave()*/}
            {/*		}*/}
            {/*	} }*/}
            {/*/>*/}
        </Modal>
    )
}
