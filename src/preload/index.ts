import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// BLE device interface
interface BleDevice {
    deviceId: string
    deviceName: string
}

// BLE state interface
interface BleState {
    selectedDevice: BleDevice | null
    isConnected: boolean
    isScanning: boolean
    discoveredDevices: BleDevice[]
}

// BLE API for renderer
const bleApi = {
    // Start scanning for BLE devices
    startScan: (): Promise<BleDevice[]> => ipcRenderer.invoke('ble:start-scan'),

    // Stop scanning
    stopScan: (): Promise<void> => ipcRenderer.invoke('ble:stop-scan'),

    // Get discovered devices
    getDevices: (): Promise<BleDevice[]> =>
        ipcRenderer.invoke('ble:get-devices'),

    // Select a device for connection
    selectDevice: (deviceId: string): Promise<boolean> =>
        ipcRenderer.invoke('ble:select-device', deviceId),

    // Get connection state
    getState: (): Promise<BleState> => ipcRenderer.invoke('ble:get-state'),

    // Set connection state
    setConnected: (connected: boolean): Promise<void> =>
        ipcRenderer.invoke('ble:set-connected', connected),

    // Get ZMK service UUID
    getServiceUuid: (): Promise<string> =>
        ipcRenderer.invoke('ble:get-service-uuid'),

    // Get ZMK characteristic UUID
    getCharacteristicUuid: (): Promise<string> =>
        ipcRenderer.invoke('ble:get-characteristic-uuid'),

    // Listen for devices discovered event
    onDevicesDiscovered: (
        callback: (devices: BleDevice[]) => void,
    ): (() => void) => {
        const handler = (
            _event: Electron.IpcRendererEvent,
            devices: BleDevice[],
        ): void => callback(devices)
        ipcRenderer.on('ble:devices-discovered', handler)
        return (): void => {
            ipcRenderer.removeListener('ble:devices-discovered', handler)
        }
    },
}

// Custom APIs for renderer
const api = {
    ble: bleApi,
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
