import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron'

// ZMK Studio GATT Service UUID
const ZMK_STUDIO_SERVICE_UUID = '00000000-0196-6107-c967-c5cfb1c2482a'
const ZMK_STUDIO_CHARACTERISTIC_UUID = '00000001-0196-6107-c967-c5cfb1c2482a'

// Store for managing BLE state
interface BleDevice {
    deviceId: string
    deviceName: string
}

interface BleState {
    selectedDevice: BleDevice | null
    isConnected: boolean
    isScanning: boolean
    discoveredDevices: BleDevice[]
}

const bleState: BleState = {
    selectedDevice: null,
    isConnected: false,
    isScanning: false,
    discoveredDevices: [],
}

// Device selection callback for Electron's Web Bluetooth
let deviceSelectionCallback: ((deviceId: string) => void) | null = null
let deviceSelectionCancelCallback: (() => void) | null = null

/**
 * Initialize BLE handlers for the main process
 */
export function initBleHandlers(mainWindow: BrowserWindow): void {
    // Handle Bluetooth device selection request from renderer
    mainWindow.webContents.on(
        'select-bluetooth-device',
        (event, devices, callback) => {
            event.preventDefault()

            // Store discovered devices
            bleState.discoveredDevices = devices.map(
                (device: { deviceId: string; deviceName: string }) => ({
                    deviceId: device.deviceId,
                    deviceName: device.deviceName || 'Unknown Device',
                }),
            )

            // If we have a pending selection callback, use it
            if (deviceSelectionCallback) {
                // Notify renderer that devices are available
                mainWindow.webContents.send(
                    'ble:devices-discovered',
                    bleState.discoveredDevices,
                )
                // Store the callback for later use
                deviceSelectionCallback = (deviceId: string): void => {
                    callback(deviceId)
                }
                deviceSelectionCancelCallback = (): void => {
                    callback('')
                }
            } else {
                // Auto-select first device if no callback set
                if (devices.length > 0) {
                    callback(devices[0].deviceId)
                } else {
                    callback('')
                }
            }
        },
    )

    // IPC Handlers for BLE operations

    // Start scanning for BLE devices
    ipcMain.handle('ble:start-scan', async (): Promise<BleDevice[]> => {
        bleState.isScanning = true
        bleState.discoveredDevices = []
        // The actual scanning happens when navigator.bluetooth.requestDevice is called
        // from the renderer, which triggers 'select-bluetooth-device' event
        return bleState.discoveredDevices
    })

    // Stop scanning
    ipcMain.handle('ble:stop-scan', async (): Promise<void> => {
        bleState.isScanning = false
        if (deviceSelectionCancelCallback) {
            deviceSelectionCancelCallback()
            deviceSelectionCancelCallback = null
        }
    })

    // Get discovered devices
    ipcMain.handle('ble:get-devices', async (): Promise<BleDevice[]> => {
        return bleState.discoveredDevices
    })

    // Select a device for connection
    ipcMain.handle(
        'ble:select-device',
        async (
            _event: IpcMainInvokeEvent,
            deviceId: string,
        ): Promise<boolean> => {
            const device = bleState.discoveredDevices.find(
                (d) => d.deviceId === deviceId,
            )
            if (device) {
                bleState.selectedDevice = device
                if (deviceSelectionCallback) {
                    deviceSelectionCallback(deviceId)
                    deviceSelectionCallback = null
                }
                return true
            }
            return false
        },
    )

    // Get connection state
    ipcMain.handle('ble:get-state', async (): Promise<BleState> => {
        return bleState
    })

    // Set connection state (called from renderer after GATT connection)
    ipcMain.handle(
        'ble:set-connected',
        async (
            _event: IpcMainInvokeEvent,
            connected: boolean,
        ): Promise<void> => {
            bleState.isConnected = connected
            if (!connected) {
                bleState.selectedDevice = null
            }
        },
    )

    // Get the ZMK service UUID
    ipcMain.handle('ble:get-service-uuid', async (): Promise<string> => {
        return ZMK_STUDIO_SERVICE_UUID
    })

    // Get the ZMK characteristic UUID
    ipcMain.handle('ble:get-characteristic-uuid', async (): Promise<string> => {
        return ZMK_STUDIO_CHARACTERISTIC_UUID
    })
}

/**
 * Clean up BLE handlers
 */
export function cleanupBleHandlers(): void {
    ipcMain.removeHandler('ble:start-scan')
    ipcMain.removeHandler('ble:stop-scan')
    ipcMain.removeHandler('ble:get-devices')
    ipcMain.removeHandler('ble:select-device')
    ipcMain.removeHandler('ble:get-state')
    ipcMain.removeHandler('ble:set-connected')
    ipcMain.removeHandler('ble:get-service-uuid')
    ipcMain.removeHandler('ble:get-characteristic-uuid')
}
