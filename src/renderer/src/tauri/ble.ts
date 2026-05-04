// Pattern check: Adapter (Tier 1) — extended — bridges Tauri gatt_connect command into IpcTransportAdapter contract
import {invoke} from '@tauri-apps/api/core'
import type {AvailableDevice} from '../transport/types'
import {
    IpcTransportAdapter,
    tauriIpc,
    type IpcConnectResult,
} from '../transport/adapter/ipc-adapter'
import {registerTransport} from '../transport/adapter/registry'

export class TauriBleAdapter extends IpcTransportAdapter {
    constructor (
        private readonly dev: AvailableDevice,
        private readonly serviceUuid: string,
        private readonly charUuid: string,
    ) {
        super( tauriIpc, dev.label )
    }

    protected async connectIpc (): Promise<IpcConnectResult> {
        const ok = await invoke( 'gatt_connect', {
            ...this.dev,
            serviceUuid: this.serviceUuid,
            charUuid: this.charUuid,
        } )
        if ( !ok ) throw new Error( 'Failed to connect' )
        return {label: this.dev.label}
    }
}

export async function list_devices (
    serviceUuid: string,
    charUuid: string,
): Promise<Array<AvailableDevice>> {
    return await invoke( 'gatt_list_devices', {serviceUuid, charUuid} )
}

registerTransport( {
    id: 'tauri:ble',
    envs: 'tauri',
    create ( ctx ) {
        const ble = ctx.bleDiscovery()
        if ( !ble ) return null
        return {
            label: 'BLE',
            communication: 'ble',
            isWireless: true,
            pick_and_connect: {
                list: () => list_devices( ble.serviceUuid, ble.charUuid ),
                connect: ( dev ) =>
                    new TauriBleAdapter(
                        dev,
                        ble.serviceUuid,
                        ble.charUuid,
                    ).connect(),
            },
        }
    },
} )
