// Pattern check: Adapter (Tier 1) — extended — bridges Electron HID_CONNECT IPC into IpcTransportAdapter contract
import { IpcChannels } from '../../../shared/ipc-types'
import type { HidDiscoveryPayload } from '../../../shared/ipc-types'
import type { AvailableDevice } from '../transport/types'
import {
    IpcTransportAdapter,
    electronIpc,
    type IpcConnectResult,
} from '../transport/adapter/ipc-adapter'
import { registerTransport } from '../transport/adapter/registry'

export class ElectronHidAdapter extends IpcTransportAdapter {
    constructor(private readonly dev: AvailableDevice) {
        super(electronIpc, dev.label)
    }

    protected async connectIpc(): Promise<IpcConnectResult> {
        const result = (await window.api.invoke(IpcChannels.HID_CONNECT, {
            device: this.dev,
        })) as { ok: boolean; label?: string; error?: string }
        if (!result.ok) {
            throw new Error(result.error ?? 'HID connect failed')
        }
        return { label: result.label ?? this.dev.label }
    }
}

export async function list_devices(
    discovery: HidDiscoveryPayload,
): Promise<Array<AvailableDevice>> {
    return (await window.api.invoke(
        IpcChannels.HID_LIST_DEVICES,
        discovery,
    )) as AvailableDevice[]
}

registerTransport({
    id: 'electron:hid',
    envs: 'electron',
    create(ctx) {
        const hid = ctx.hidDiscovery()
        if (!hid) return null
        return {
            label: 'HID',
            communication: 'hid',
            pick_and_connect: {
                list: () => list_devices(hid),
                connect: (dev) => new ElectronHidAdapter(dev).connect(),
            },
        }
    },
})
