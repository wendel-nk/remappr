import { ElectronAPI } from '@electron-toolkit/preload'

export interface SerialDeviceInfo {
    id: string
    label: string
    path: string
    manufacturer?: string
    serialNumber?: string
    vendorId?: string
    productId?: string
}

export interface SerialAPI {
    list: () => Promise<SerialDeviceInfo[]>
    connect: (deviceId: string, baudRate?: number) => Promise<boolean>
    disconnect: () => Promise<void>
    write: (data: number[]) => Promise<void>
    isConnected: () => Promise<boolean>
    onData: (callback: (data: number[]) => void) => () => void
    onError: (callback: (error: string) => void) => () => void
    onDisconnected: (callback: () => void) => () => void
}

export interface API {
    serial: SerialAPI
}

declare global {
    interface Window {
        electron: ElectronAPI
        api: API
    }
}
