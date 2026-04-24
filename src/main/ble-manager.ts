/**
 * BLE Manager for Electron main process.
 *
 * Coordinates BLE device selection using Electron's built-in Web Bluetooth support.
 * The renderer triggers scans via navigator.bluetooth.requestDevice(), and the main
 * process collects discovered devices via the 'select-bluetooth-device' event.
 *
 * Flow:
 * 1. Renderer calls BLE_START_SCAN IPC, then navigator.bluetooth.requestDevice()
 * 2. Main process receives 'select-bluetooth-device' events with discovered devices
 * 3. Main forwards device lists to renderer via BLE_DEVICES_DISCOVERED event
 * 4. User picks a device in the renderer UI
 * 5. Renderer calls BLE_SELECT_DEVICE IPC with the chosen deviceId
 * 6. Main calls the pending callback, resolving requestDevice() in the renderer
 * 7. Renderer proceeds with GATT connection using the resolved BluetoothDevice
 */

import { ipcMain, type BrowserWindow } from 'electron'
import {
    IpcChannels,
    IpcEvents,
    type AvailableDevice,
} from '../shared/ipc-types'

// ZMK Studio BLE service UUID
export const ZMK_STUDIO_SERVICE_UUID = '00000000-0196-6107-c967-c5cfb1c2482a'

/** Pending device selection callback from Electron's select-bluetooth-device event */
let pendingDeviceCallback: ((deviceId: string) => void) | null = null

/** Whether we're actively scanning for BLE devices */
let isScanning = false

/**
 * Set up the Web Bluetooth device selection handler on a BrowserWindow.
 * Must be called for each window that will use BLE.
 *
 * When the renderer calls navigator.bluetooth.requestDevice(), Electron fires
 * the 'select-bluetooth-device' event. This handler collects discovered devices
 * and forwards them to the renderer for user selection.
 */
export function setupBleDeviceSelection(window: BrowserWindow): void {
    window.webContents.on(
        'select-bluetooth-device',
        (event, devices, callback) => {
            event.preventDefault()

            // Store the callback so we can resolve it when the user picks a device
            pendingDeviceCallback = callback

            if (!isScanning) {
                // Not in scan mode - auto-select first device (fallback behavior)
                if (devices.length > 0) {
                    callback(devices[0].deviceId)
                    pendingDeviceCallback = null
                }
                return
            }

            // Convert Electron's device format to our AvailableDevice format
            const availableDevices: AvailableDevice[] = devices.map((d) => ({
                label: d.deviceName || `BLE Device (${d.deviceId.slice(0, 8)})`,
                id: d.deviceId,
            }))

            // Send discovered devices to the renderer
            if (!window.isDestroyed()) {
                window.webContents.send(
                    IpcEvents.BLE_DEVICES_DISCOVERED,
                    availableDevices,
                )
            }
        },
    )
}

/**
 * Register BLE-specific IPC handlers for scan coordination.
 * Called once during app initialization.
 */
export function registerBleIpcHandlers(): void {
    ipcMain.handle(IpcChannels.BLE_START_SCAN, async () => {
        isScanning = true
        pendingDeviceCallback = null
    })

    ipcMain.handle(IpcChannels.BLE_STOP_SCAN, async () => {
        isScanning = false
        // Cancel any pending device request
        if (pendingDeviceCallback) {
            pendingDeviceCallback('')
            pendingDeviceCallback = null
        }
    })

    ipcMain.handle(
        IpcChannels.BLE_SELECT_DEVICE,
        async (_, deviceId: unknown) => {
            if (typeof deviceId !== 'string' || !deviceId) {
                return false
            }

            isScanning = false

            if (pendingDeviceCallback) {
                pendingDeviceCallback(deviceId)
                pendingDeviceCallback = null
                return true
            }

            return false
        },
    )
}
