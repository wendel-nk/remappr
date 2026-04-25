// pattern-check: skip — noble adapter mirrors electron/ble.ts BlueZ path,
// no class abstraction, just IPC plumbing.
/**
 * Noble (raw HCI) BLE adapter for the renderer.
 *
 * Linux-only. Talks to main-process noble client which uses raw HCI to
 * bypass BlueZ. Useful as a fallback when BlueZ-mediated GATT writes get
 * silently dropped by ZMK firmware.
 */

import { IpcChannels, IpcEvents } from '../../../shared/ipc-types'
import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import type { AvailableDevice } from '../transport/types'

export async function list_devices(): Promise<AvailableDevice[]> {
    console.log('[electron/noble-ble] list_devices() called')
    try {
        const devices = (await window.api.invoke(
            IpcChannels.NOBLE_LIST_DEVICES,
        )) as AvailableDevice[]
        console.log('[electron/noble-ble] returned', devices.length, 'devices')
        return devices
    } catch (e) {
        console.error('[electron/noble-ble] NOBLE_LIST_DEVICES failed:', e)
        return []
    }
}

export async function connect(dev: AvailableDevice): Promise<RpcTransport> {
    const result = (await window.api.invoke(
        IpcChannels.NOBLE_CONNECT,
        dev.id,
    )) as { ok: boolean; label?: string; error?: string }

    if (!result.ok) {
        throw new Error(result.error ?? 'Failed to connect via noble')
    }

    const abortController = new AbortController()

    const writable = new WritableStream<Uint8Array>({
        async write(chunk) {
            await window.api.invoke(
                IpcChannels.TRANSPORT_SEND_DATA,
                new Uint8Array(chunk),
            )
        },
    })

    const { writable: responseWritable, readable } =
        new TransformStream<Uint8Array>()

    const unlistenData = window.api.on(
        IpcEvents.CONNECTION_DATA,
        async (...args: unknown[]) => {
            const data = args[0] as number[]
            const writer = responseWritable.getWriter()
            await writer.write(new Uint8Array(data))
            writer.releaseLock()
        },
    )

    const unlistenDisconnected = window.api.on(
        IpcEvents.CONNECTION_DISCONNECTED,
        async () => {
            unlistenData()
            unlistenDisconnected()
            responseWritable.close().catch(() => {})
        },
    )

    const signal = abortController.signal
    const onAbort = async (): Promise<void> => {
        unlistenData()
        unlistenDisconnected()
        await window.api.invoke(IpcChannels.TRANSPORT_CLOSE).catch(() => {})
        signal.removeEventListener('abort', onAbort)
    }
    signal.addEventListener('abort', onAbort)

    return {
        label: result.label ?? dev.label ?? 'BLE Device',
        abortController,
        readable,
        writable,
    }
}
