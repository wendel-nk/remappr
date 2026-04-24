/**
 * BLE Manager for Electron main process.
 *
 * Coordinates BLE device selection using Electron's built-in Web Bluetooth support.
 * Electron's Chromium provides Web Bluetooth API in the renderer process.
 * The main process handles device selection via the 'select-bluetooth-device' event
 * on BrowserWindow.webContents.
 *
 * Architecture:
 * - Device scanning/GATT operations happen in the renderer using Web Bluetooth API
 * - Main process only coordinates device selection (approve/deny device requests)
 * - Data flows through Web Bluetooth streams in the renderer, not through IPC
 */

import type { BrowserWindow } from 'electron'

// ZMK Studio BLE service UUID
export const ZMK_STUDIO_SERVICE_UUID = '00000000-0196-6107-c967-c5cfb1c2482a'

/**
 * Set up the Web Bluetooth device selection handler on a BrowserWindow.
 * Must be called for each window that will use BLE.
 *
 * When the renderer calls navigator.bluetooth.requestDevice(), Electron fires
 * the 'select-bluetooth-device' event. Without a handler, the request is cancelled.
 * This handler auto-selects the first matching device after a short collection period.
 */
export function setupBleDeviceSelection(window: BrowserWindow): void {
    window.webContents.on(
        'select-bluetooth-device',
        (event, devices, callback) => {
            event.preventDefault()

            // If devices are available, select the first one.
            // The renderer filters by service UUID via requestDevice filters,
            // so all devices here already match the ZMK Studio service.
            if (devices.length > 0) {
                callback(devices[0].deviceId)
            }
            // If no devices yet, don't call callback - Chromium will fire
            // the event again as more devices are discovered.
        },
    )
}
