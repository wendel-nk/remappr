import { ElectronAPI } from '@electron-toolkit/preload'

export interface TransportApi {
    serial: {
        listDevices: () => Promise<Array<{ label: string; id: string }>>
        connect: (device: {
            label: string
            id: string
        }) => Promise<boolean>
        disconnect: () => Promise<void>
    }
    ble: {
        listDevices: () => Promise<Array<{ label: string; id: string }>>
        connect: (device: {
            label: string
            id: string
        }) => Promise<boolean>
    }
    sendData: (data: number[]) => Promise<void>
    close: () => Promise<void>
    onConnectionData: (callback: (data: number[]) => void) => () => void
    onConnectionDisconnected: (callback: () => void) => () => void
}

declare global {
    interface Window {
        electron: ElectronAPI
        api: TransportApi
    }
}
