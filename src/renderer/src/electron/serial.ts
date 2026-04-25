// pattern-check: skip — merge conflict resolution, no new logic
import { IpcChannels, IpcEvents } from '../../../shared/ipc-types'
import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import type { AvailableDevice } from '../transport/types'

export async function list_devices(): Promise<Array<AvailableDevice>> {
    return (await window.api.invoke(
        IpcChannels.SERIAL_LIST_DEVICES,
    )) as AvailableDevice[]
}

export async function connect(dev: AvailableDevice): Promise<RpcTransport> {
    if (!(await window.api.invoke(IpcChannels.SERIAL_CONNECT, dev))) {
        throw new Error('Failed to connect')
    }

    const abortController = new AbortController()

    const writable = new WritableStream({
        async write(chunk) {
            await window.api.invoke(
                IpcChannels.TRANSPORT_SEND_DATA,
                new Uint8Array(chunk),
            )
        },
    })

    const { writable: response_writable, readable } = new TransformStream()

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
            response_writable.close()
        },
    )

    const signal = abortController.signal

    const abort_cb = async (): Promise<void> => {
        unlisten_data()
        unlisten_disconnected()
        await window.api.invoke(IpcChannels.TRANSPORT_CLOSE)
        signal.removeEventListener('abort', abort_cb)
    }

    signal.addEventListener('abort', abort_cb)

    return { label: dev.label, abortController, readable, writable }
}

export async function disconnect(): Promise<void> {
    await window.api.invoke(IpcChannels.SERIAL_DISCONNECT)
}
