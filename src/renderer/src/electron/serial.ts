import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import type { AvailableDevice } from '../transport/types'

export async function list_devices(): Promise<Array<AvailableDevice>> {
    return await window.api.serial.listDevices()
}

export async function connect(dev: AvailableDevice): Promise<RpcTransport> {
    if (!(await window.api.serial.connect(dev))) {
        throw new Error('Failed to connect')
    }

    const abortController = new AbortController()

    const writable = new WritableStream({
        async write(chunk) {
            await window.api.sendData(Array.from(new Uint8Array(chunk)))
        },
    })

    const { writable: response_writable, readable } =
        new TransformStream<Uint8Array>()

    const unlisten_data = window.api.onConnectionData(
        async (data: number[]) => {
            const writer = response_writable.getWriter()
            await writer.write(new Uint8Array(data))
            writer.releaseLock()
        },
    )

    const unlisten_disconnected = window.api.onConnectionDisconnected(
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
        await window.api.close()
        signal.removeEventListener('abort', abort_cb)
    }

    signal.addEventListener('abort', abort_cb)

    return { label: dev.label, abortController, readable, writable }
}

export async function disconnect(): Promise<void> {
    await window.api.serial.disconnect()
}
