import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface SerialDeviceInfo {
    id: string
    label: string
    path: string
    manufacturer?: string
    serialNumber?: string
    vendorId?: string
    productId?: string
}

// Custom APIs for renderer
const api = {
    serial: {
        list: (): Promise<SerialDeviceInfo[]> =>
            ipcRenderer.invoke('serial:list'),
        connect: (deviceId: string, baudRate?: number): Promise<boolean> =>
            ipcRenderer.invoke('serial:connect', deviceId, baudRate),
        disconnect: (): Promise<void> =>
            ipcRenderer.invoke('serial:disconnect'),
        write: (data: number[]): Promise<void> =>
            ipcRenderer.invoke('serial:write', data),
        isConnected: (): Promise<boolean> =>
            ipcRenderer.invoke('serial:isConnected'),
        onData: (callback: (data: number[]) => void): (() => void) => {
            const handler = (
                _event: Electron.IpcRendererEvent,
                data: number[],
            ): void => {
                callback(data)
            }
            ipcRenderer.on('serial:data', handler)
            return (): void => {
                ipcRenderer.removeListener('serial:data', handler)
            }
        },
        onError: (callback: (error: string) => void): (() => void) => {
            const handler = (
                _event: Electron.IpcRendererEvent,
                error: string,
            ): void => {
                callback(error)
            }
            ipcRenderer.on('serial:error', handler)
            return (): void => {
                ipcRenderer.removeListener('serial:error', handler)
            }
        },
        onDisconnected: (callback: () => void): (() => void) => {
            const handler = (): void => {
                callback()
            }
            ipcRenderer.on('serial:disconnected', handler)
            return (): void => {
                ipcRenderer.removeListener('serial:disconnected', handler)
            }
        },
    },
}

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
