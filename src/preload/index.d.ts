import { ElectronAPI } from '@electron-toolkit/preload'

// BLE device interface
export interface BleDevice {
    deviceId: string
    deviceName: string
}

// BLE state interface
export interface BleState {
    selectedDevice: BleDevice | null
    isConnected: boolean
    isScanning: boolean
    discoveredDevices: BleDevice[]
}

// BLE API interface
export interface BleApi {
    startScan: () => Promise<BleDevice[]>
    stopScan: () => Promise<void>
    getDevices: () => Promise<BleDevice[]>
    selectDevice: (deviceId: string) => Promise<boolean>
    getState: () => Promise<BleState>
    setConnected: (connected: boolean) => Promise<void>
    getServiceUuid: () => Promise<string>
    getCharacteristicUuid: () => Promise<string>
    onDevicesDiscovered: (
        callback: (devices: BleDevice[]) => void,
    ) => () => void
}

// API interface
export interface Api {
    ble: BleApi
}

declare global {
    interface Window {
        electron: ElectronAPI
        api: Api
    }
}
