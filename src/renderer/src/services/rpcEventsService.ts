import { toast } from 'sonner'
import {
    Keymap,
    PhysicalLayout,
} from '@zmkfirmware/zmk-studio-ts-client/keymap'
import { callRpc } from '@/services/rpcCall'

export const getKeymapLayout = async (
    layoutIndex: number,
    layouts: PhysicalLayout[],
): Promise<void> => {
    if (!layouts) return

    const resp = await callRpc({
        keymap: { setActivePhysicalLayout: layoutIndex },
    })

    const new_keymap = resp?.keymap?.setActivePhysicalLayout?.ok
    if (!new_keymap) {
        console.error(
            'Failed to set the active physical layout err:',
            resp?.keymap?.setActivePhysicalLayout?.err,
        )
    }
}

export async function setKeymapRequest(
    layouts: PhysicalLayout[],
    selectedPhysicalLayoutIndex: number,
): Promise<Keymap | undefined> {
    if (!layouts) {
        return
    }

    const resp = await callRpc({
        keymap: {
            setActivePhysicalLayout: selectedPhysicalLayoutIndex,
        },
    })

    if (!resp?.keymap) {
        console.warn(
            'setKeymapRequest: No response (connection may have been closed)',
        )
        return
    }

    const new_keymap = resp?.keymap?.setActivePhysicalLayout?.ok

    if (!new_keymap) {
        toast.error(
            'Failed to set the active physical layout err:' +
                resp?.keymap?.setActivePhysicalLayout?.err,
        )
        console.error(
            'Failed to set the active physical layout err:',
            resp?.keymap?.setActivePhysicalLayout?.err,
        )
    }

    return new_keymap
}
