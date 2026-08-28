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

import { type BrowserWindow, ipcMain } from 'electron'
import {
    type AvailableDevice,
    IpcChannels,
    IpcEvents,
} from '../shared/ipc-types'
import { createLogger } from '../shared/logger'

const log = createLogger('ble-manager')

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

            log.info(
                'select-bluetooth-device fired, devices:',
                devices.length,
                devices.map(
                    (d) => `${d.deviceName || '(no-name)'}@${d.deviceId}`,
                ),
            )

            // Store the callback so we can resolve it when the user picks a device
            pendingDeviceCallback = callback

            // ZMK keyboards don't always include a friendly name in the BLE
            // advertising payload — when already paired+connected to the OS,
            // Chromium can fire `select-bluetooth-device` once with an empty
            // name and never re-fire (no fresh advertisement). Keep every
            // device and label name-less / "Unknown or Unsupported" entries
            // by id so the user can still pick. Chromium uses the format
            // "Unknown or Unsupported Device (MAC)"; surface as "BLE <id>".
            const availableDevices: AvailableDevice[] = devices.map((d) => {
                const raw = (d.deviceName || '').trim()
                const isUnknown = !raw || /^Unknown or Unsupported/i.test(raw)
                const label = isUnknown ? `BLE ${d.deviceId}` : raw
                return { label, id: d.deviceId }
            })

            log.info('forwarding to renderer, kept:', availableDevices.length)

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
        log.info('BLE_START_SCAN received')
        pendingDeviceCallback = null
    })

    ipcMain.handle(IpcChannels.BLE_STOP_SCAN, async () => {
        log.info('BLE_STOP_SCAN received')
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

            // The renderer may call BLE_SELECT_DEVICE before Chromium has
            // fired the next select-bluetooth-device event (which sets
            // pendingDeviceCallback). Wait briefly for it to arrive instead
            // of returning false immediately — fixes second-click failures
            // when the previous callback was already consumed.
            const deadline = Date.now() + 3000
            while (!pendingDeviceCallback && Date.now() < deadline) {
                await new Promise((r) => setTimeout(r, 50))
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
