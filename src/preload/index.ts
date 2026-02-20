import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Transport API for renderer process
const transportApi = {
    serial: {
        listDevices: (): Promise<Array<{ label: string; id: string }>> =>
            ipcRenderer.invoke('serial:list-devices'),
        connect: (device: {
            label: string
            id: string
        }): Promise<boolean> => ipcRenderer.invoke('serial:connect', device),
        disconnect: (): Promise<void> =>
            ipcRenderer.invoke('serial:disconnect'),
    },
    ble: {
        listDevices: (): Promise<Array<{ label: string; id: string }>> =>
            ipcRenderer.invoke('ble:list-devices'),
        connect: (device: {
            label: string
            id: string
        }): Promise<boolean> => ipcRenderer.invoke('ble:connect', device),
    },
    sendData: (data: number[]): Promise<void> =>
        ipcRenderer.invoke('transport:send-data', data),
    close: (): Promise<void> => ipcRenderer.invoke('transport:close'),
    onConnectionData: (
        callback: (data: number[]) => void,
    ): (() => void) => {
        const handler = (
            _event: Electron.IpcRendererEvent,
            data: number[],
        ): void => callback(data)
        ipcRenderer.on('transport:connection-data', handler)
        return (): void => {
            ipcRenderer.removeListener('transport:connection-data', handler)
        }
    },
    onConnectionDisconnected: (callback: () => void): (() => void) => {
        const handler = (): void => callback()
        ipcRenderer.on('transport:connection-disconnected', handler)
        return (): void => {
            ipcRenderer.removeListener(
                'transport:connection-disconnected',
                handler,
            )
        }
    },
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('api', transportApi)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore (define in dts)
    window.electron = electronAPI
    // @ts-ignore (define in dts)
    window.api = transportApi
}
