// Pattern check: Adapter (Tier 1) — extended — extends src/renderer/src/electron/serial.ts pattern; bridges HID IPC channels into the @firmware Transport contract.
import { IpcChannels, IpcEvents } from '../../../shared/ipc-types'
import type { HidDiscoveryPayload } from '../../../shared/ipc-types'
import type { Transport } from '@firmware'
import type { AvailableDevice } from '../transport/types'

export async function list_devices(
    discovery: HidDiscoveryPayload,
): Promise<Array<AvailableDevice>> {
    return (await window.api.invoke(
        IpcChannels.HID_LIST_DEVICES,
        discovery,
    )) as AvailableDevice[]
}

export async function connect(dev: AvailableDevice): Promise<Transport> {
    const result = (await window.api.invoke(IpcChannels.HID_CONNECT, {
        device: dev,
    })) as { ok: boolean; label?: string; error?: string }
    if (!result.ok) {
        throw new Error(result.error ?? 'HID connect failed')
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

    const { writable: response_writable, readable } = new TransformStream<
        Uint8Array,
        Uint8Array
    >()

    const unlisten_data = window.api.on(
        IpcEvents.CONNECTION_DATA,
        async (...args: unknown[]) => {
            const data = args[0] as number[]
            const writer = response_writable.getWriter()
            await writer.write(new Uint8Array(data))
            writer.releaseLock()
        },
    )

    const unlisten_disconnected = window.api.on(
        IpcEvents.CONNECTION_DISCONNECTED,
        async () => {
            unlisten_data()
            unlisten_disconnected()
            try {
                await response_writable.close()
            } catch {
                /* already closed */
            }
        },
    )

    const abort_cb = async (): Promise<void> => {
        unlisten_data()
        unlisten_disconnected()
        await window.api.invoke(IpcChannels.TRANSPORT_CLOSE)
        abortController.signal.removeEventListener('abort', abort_cb)
    }

    abortController.signal.addEventListener('abort', abort_cb)

    return {
        label: result.label ?? dev.label,
        abortController,
        readable,
        writable,
    }
}
