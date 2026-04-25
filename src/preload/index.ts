// pattern-check: skip — merge conflict resolution, no new logic
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
    IpcChannels,
    IpcEvents,
    type ElectronIpcApi,
} from '../shared/ipc-types'

// Allowed invoke channels (whitelist for security)
const VALID_INVOKE_CHANNELS = new Set<string>(Object.values(IpcChannels))

// Allowed event channels (whitelist for security)
const VALID_EVENT_CHANNELS = new Set<string>(Object.values(IpcEvents))

// Custom IPC API for renderer
const api = {
    invoke(channel: string, ...args: unknown[]): Promise<unknown> {
        if (!VALID_INVOKE_CHANNELS.has(channel)) {
            return Promise.reject(
                new Error(`Invalid IPC channel: ${channel}`),
            )
        }
        return ipcRenderer.invoke(channel, ...args)
    },

    on(
        event: string,
        callback: (...args: unknown[]) => void,
    ): () => void {
        if (!VALID_EVENT_CHANNELS.has(event)) {
            throw new Error(`Invalid IPC event: ${event}`)
        }

        const listener = (
            _event: Electron.IpcRendererEvent,
            ...args: unknown[]
        ): void => {
            callback(...args)
        }

        ipcRenderer.on(event, listener)

        // Return an unsubscribe function
        return (): void => {
            ipcRenderer.removeListener(event, listener)
        }
    },
} satisfies ElectronIpcApi

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('api', api)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore (define in dts)
    window.electron = electronAPI
    // @ts-ignore (define in dts)
    window.api = api
}
