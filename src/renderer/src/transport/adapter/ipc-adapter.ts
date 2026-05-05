// Pattern check: Template Method (Tier 1) — applied — connect() owns lifecycle, defers connectIpc() to subclasses; PlatformIpc is Strategy
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Transport } from '@firmware'
import { IpcChannels, IpcEvents } from '../../../../shared/ipc-types'
import { TransportAdapter } from './base'

export type Unlisten = () => void

/**
 * Per-platform IPC primitives. Strategy injected into
 * {@link IpcTransportAdapter}. `onConnectionData` / `onConnectionDisconnected`
 * always return `Promise<Unlisten>` so Electron (sync) and Tauri (async)
 * subscriptions share a signature.
 */
export interface PlatformIpc {
    sendData(data: Uint8Array): Promise<void>

    close(): Promise<void>

    onConnectionData(cb: (bytes: Uint8Array) => void): Promise<Unlisten>

    onConnectionDisconnected(cb: () => void): Promise<Unlisten>
}

export interface IpcConnectResult {
    /** Display name from the device, falls back to the dev.label passed to the adapter. */
    label?: string
}

/**
 * Concrete connect() lifecycle: invoke platform IPC to open the connection,
 * wire the response stream + abort handling, return a {@link Transport}.
 * Subclasses only override `connectIpc()` to issue the per-transport invoke.
 */
export abstract class IpcTransportAdapter extends TransportAdapter {
    constructor(
        protected readonly platform: PlatformIpc,
        defaultLabel: string,
    ) {
        super()
        this.label = defaultLabel
    }

    /** Issue the platform's connect IPC. Throw to abort the open. */
    protected abstract connectIpc(): Promise<IpcConnectResult>

    async connect(): Promise<Transport> {
        const result = await this.connectIpc()
        if (result.label) this.label = result.label

        const writable = new WritableStream<Uint8Array>({
            write: (chunk) => this.platform.sendData(new Uint8Array(chunk)),
        })

        const { writable: respWritable, readable } = new TransformStream<
            Uint8Array,
            Uint8Array
        >()
        const responseWriter = respWritable.getWriter()

        const unlistenData = await this.platform.onConnectionData(
            async (bytes) => {
                try {
                    await responseWriter.write(bytes)
                } catch {
                    /* stream closed */
                }
            },
        )

        let unlistenDisc: Unlisten = () => {}
        unlistenDisc = await this.platform.onConnectionDisconnected(() => {
            unlistenData()
            unlistenDisc()
            responseWriter.close().catch(() => {})
        })

        const signal = this.abortController.signal
        const onAbort = async (): Promise<void> => {
            unlistenData()
            unlistenDisc()
            responseWriter.close().catch(() => {})
            await this.platform.close().catch(() => {})
            signal.removeEventListener('abort', onAbort)
        }
        signal.addEventListener('abort', onAbort)

        return {
            label: this.label,
            abortController: this.abortController,
            readable,
            writable,
        }
    }
}

/**
 * Electron PlatformIpc strategy. window.api.on returns a sync unlisten;
 * wrap in Promise.resolve to satisfy the async contract.
 */
export const electronIpc: PlatformIpc = {
    async sendData(data) {
        await window.api.invoke(IpcChannels.TRANSPORT_SEND_DATA, data)
    },
    async close() {
        await window.api.invoke(IpcChannels.TRANSPORT_CLOSE)
    },
    async onConnectionData(cb) {
        const unlisten = window.api.on(
            IpcEvents.CONNECTION_DATA,
            (...args: unknown[]) => {
                const data = args[0] as number[]
                cb(new Uint8Array(data))
            },
        )
        return unlisten
    },
    async onConnectionDisconnected(cb) {
        return window.api.on(IpcEvents.CONNECTION_DISCONNECTED, cb)
    },
}

/**
 * Tauri PlatformIpc strategy. listen() is async and returns an UnlistenFn.
 */
export const tauriIpc: PlatformIpc = {
    async sendData(data) {
        await invoke('transport_send_data', data)
    },
    async close() {
        await invoke('transport_close')
    },
    async onConnectionData(cb) {
        return await listen(
            'connection_data',
            (event: { payload: number[] }) => {
                cb(new Uint8Array(event.payload))
            },
        )
    },
    async onConnectionDisconnected(cb) {
        return await listen('connection_disconnected', () => cb())
    },
}
