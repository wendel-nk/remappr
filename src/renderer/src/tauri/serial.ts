// Pattern check: Adapter (Tier 1) — extended — bridges Tauri serial_connect command into IpcTransportAdapter contract
import {invoke} from '@tauri-apps/api/core'
import type {AvailableDevice} from '../transport/types'
import {
    IpcTransportAdapter,
    tauriIpc,
    type IpcConnectResult,
} from '../transport/adapter/ipc-adapter'
import {registerTransport} from '../transport/adapter/registry'

export class TauriSerialAdapter extends IpcTransportAdapter {
    constructor ( private readonly dev: AvailableDevice ) {
        super( tauriIpc, dev.label )
    }

    protected async connectIpc (): Promise<IpcConnectResult> {
        const ok = await invoke( 'serial_connect', {...this.dev} )
        if ( !ok ) throw new Error( 'Failed to connect' )
        return {label: this.dev.label}
    }
}

export async function list_devices (): Promise<Array<AvailableDevice>> {
    return await invoke( 'serial_list_devices' )
}

registerTransport( {
    id: 'tauri:serial',
    envs: 'tauri',
    create () {
        return {
            label: 'USB',
            communication: 'serial',
            pick_and_connect: {
                list: () => list_devices(),
                connect: ( dev ) => new TauriSerialAdapter( dev ).connect(),
            },
        }
    },
} )
