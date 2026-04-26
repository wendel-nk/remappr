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

            console.log(
                '[ble-manager] select-bluetooth-device fired, devices:',
                devices.length,
                devices.map(
                    (d) => `${d.deviceName || '(no-name)'}@${d.deviceId}`,
                ),
            )

            // Store the callback so we can resolve it when the user picks a device
            pendingDeviceCallback = callback

            // Drop nameless ghosts. Chromium labels nameless advertisements
            // as "Unknown or Unsupported Device (MAC)" — skip those too, not
            // just truly-empty deviceName. Keyboards always advertise a real
            // friendly name.
            const availableDevices: AvailableDevice[] = devices
                .filter((d) => {
                    const n = (d.deviceName || '').trim()
                    if (!n) return false
                    if (/^Unknown or Unsupported/i.test(n)) return false
                    return true
                })
                .map((d) => ({
                    label: d.deviceName,
                    id: d.deviceId,
                }))

            console.log(
                '[ble-manager] forwarding to renderer, kept:',
                availableDevices.length,
            )

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
        console.log('[ble-manager] BLE_START_SCAN received')
        pendingDeviceCallback = null
    })

    ipcMain.handle(IpcChannels.BLE_STOP_SCAN, async () => {
        console.log('[ble-manager] BLE_STOP_SCAN received')
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

            if (pendingDeviceCallback) {
                pendingDeviceCallback(deviceId)
                pendingDeviceCallback = null
                return true
            }

            return false
        },
    )
}
