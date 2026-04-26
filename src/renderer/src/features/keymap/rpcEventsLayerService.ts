import { toast } from 'sonner'
import {
    Keymap,
    Layer,
    SetLayerPropsResponse,
} from '@zmkfirmware/zmk-studio-ts-client/keymap'
import { produce } from 'immer'
import { callRemoteProcedureControl } from '@/features/connection/callRemoteProcedureControl'

export async function addLayer(
    keymap: Keymap | undefined,
    setKeymap: (updater: (draft: Keymap) => void) => void,
    setSelectedLayerIndex: (index: number) => void,
): Promise<number> {
    if (!keymap) throw new Error('Not connected')

    const resp = await callRemoteProcedureControl({
        keymap: { addLayer: {} },
    })

    if (!resp.keymap) {
        console.warn('Add layer: No response (connection may have been closed)')
        return -1
    }

    if (!resp.keymap?.addLayer?.ok) {
        console.error('Add error', resp.keymap?.addLayer?.err)
        throw new Error('Failed to add layer:' + resp.keymap?.addLayer?.err)
    }
    const newSelection = keymap.layers.length
    console.log(
        'Adding new layer, setting selectedLayerIndex to:',
        newSelection,
    )
    const newLayer = resp.keymap!.addLayer!.ok!.layer
    if (newLayer) {
        setKeymap(
            produce((draft: Keymap) => {
                draft.layers.push(newLayer)
                draft.availableLayers--
            }),
        )
    }

    setSelectedLayerIndex(newSelection)
    console.log('setSelectedLayerIndex called with:', newSelection)

    return resp.keymap.addLayer.ok.index
}

export async function changeName(
    layerId: number,
    name: string,
    setKeymap: (updater: (draft: Keymap) => void) => void,
): Promise<void> {
    const resp = await callRemoteProcedureControl({
        keymap: { setLayerProps: { layerId, name } },
    })

    if (!resp.keymap) {
        console.warn(
            'Change name: No response (connection may have been closed)',
        )
        return
    }

    if (
        resp.keymap?.setLayerProps !=
        SetLayerPropsResponse.SET_LAYER_PROPS_RESP_OK
    ) {
        throw new Error(
            'Failed to change layer name:' + resp.keymap?.setLayerProps,
        )
    }

    setKeymap(
        produce((draft: Keymap) => {
            const layer_index = draft.layers.findIndex(
                (l: Layer) => l.id == layerId,
            )
            draft.layers[layer_index].name = name
        }),
    )
}

export async function removeLayer(
    layerIndex: number,
    setKeymap: (updater: (draft: Keymap) => void) => void,
): Promise<void> {
    const resp = await callRemoteProcedureControl({
        keymap: { removeLayer: { layerIndex } },
    })

    if (!resp.keymap) {
        console.warn(
            'Remove layer: No response (connection may have been closed)',
        )
        return
    }

    if (!resp.keymap?.removeLayer?.ok) {
        console.error('Remove error', resp.keymap?.removeLayer?.err)
        throw new Error(
            'Failed to remove layer:' + resp.keymap?.removeLayer?.err,
        )
    }

    setKeymap(
        produce((draft: Keymap) => {
            draft.layers.splice(layerIndex, 1)
            draft.availableLayers++
        }),
    )
}

export async function restore(
    layerId: number,
    atIndex: number,
    setKeymap: (updater: (draft: Keymap) => void) => void,
    setSelectedLayerIndex: (index: number) => void,
): Promise<void> {
    const resp = await callRemoteProcedureControl({
        keymap: { restoreLayer: { layerId, atIndex } },
    })

    console.log(resp)

    if (!resp.keymap) {
        console.warn(
            'Restore layer: No response (connection may have been closed)',
        )
        return
    }

    if (!resp.keymap?.restoreLayer?.ok) {
        console.error('Restore error', resp.keymap?.restoreLayer?.err)
        toast.error('Failed to restore layer:' + resp.keymap?.restoreLayer?.err)
        return
    }

    const restoredLayer = resp!.keymap!.restoreLayer!.ok
    if (restoredLayer) {
        setKeymap(
            produce((draft: Keymap) => {
                draft.layers.splice(atIndex, 0, restoredLayer)
                draft.availableLayers--
            }),
        )
    }
    console.log(atIndex)
    setSelectedLayerIndex(atIndex)
}
