/**
 * Main process IPC handler registration.
 * Registers all ipcMain.handle() handlers for request/response channels.
 * Each handler validates its input before processing.
 *
 * The actual device communication logic will be implemented in separate modules.
 * This file provides the handler registration pattern and placeholder implementations.
 */

import { ipcMain, type BrowserWindow } from 'electron'
import { IpcChannels, IpcEvents } from '../shared/ipc-types'
import { validateAvailableDevice, validateUint8Array } from './ipc-validation'

/** Send an event to all renderer windows */
function sendToAllWindows(
    windows: BrowserWindow[],
    channel: string,
    ...args: unknown[]
): void {
    for (const win of windows) {
        if (!win.isDestroyed()) {
            win.webContents.send(channel, ...args)
        }
    }
}

/**
 * Register all IPC handlers. Call this once during app initialization.
 * @param getWindows - Function that returns current BrowserWindow instances for event broadcasting
 */
export function registerIpcHandlers(
    getWindows: () => BrowserWindow[],
): void {
    // --- Serial Device Handlers ---

    ipcMain.handle(IpcChannels.SERIAL_LIST_DEVICES, async () => {
        // TODO: Implement native serial device enumeration
        return []
    })

    ipcMain.handle(
        IpcChannels.SERIAL_CONNECT,
        async (_, device: unknown) => {
            const validDevice = validateAvailableDevice(device)
            // TODO: Implement native serial connection
            console.log(`Serial connect requested for: ${validDevice.label}`)
            return false
        },
    )

    ipcMain.handle(IpcChannels.SERIAL_DISCONNECT, async () => {
        // TODO: Implement serial disconnect
    })

    // --- BLE Device Handlers ---

    ipcMain.handle(IpcChannels.BLE_LIST_DEVICES, async () => {
        // TODO: Implement native BLE device enumeration
        return []
    })

    ipcMain.handle(
        IpcChannels.BLE_CONNECT,
        async (_, device: unknown) => {
            const validDevice = validateAvailableDevice(device)
            // TODO: Implement native BLE connection
            console.log(`BLE connect requested for: ${validDevice.label}`)
            return false
        },
    )

    // --- Transport Handlers (shared by serial & BLE) ---

    ipcMain.handle(
        IpcChannels.TRANSPORT_SEND_DATA,
        async (_, data: unknown) => {
            const validData = validateUint8Array(data)
            // TODO: Implement data send over active transport
            console.log(`Transport send: ${validData.byteLength} bytes`)
        },
    )

    ipcMain.handle(IpcChannels.TRANSPORT_CLOSE, async () => {
        // TODO: Implement transport close
    })

    // Expose event helpers for use by transport implementations
    return void setupEventEmitters(getWindows)
}

/**
 * Set up event emitter helpers that transport implementations can use
 * to push data/events to the renderer process.
 */
function setupEventEmitters(getWindows: () => BrowserWindow[]): void {
    ipcHandlerContext.emitConnectionData = (data: number[]): void => {
        sendToAllWindows(getWindows(), IpcEvents.CONNECTION_DATA, data)
    }

    ipcHandlerContext.emitConnectionDisconnected = (): void => {
        sendToAllWindows(getWindows(), IpcEvents.CONNECTION_DISCONNECTED)
    }
}

/**
 * Context object holding event emitter functions for use by transport modules.
 * Transport implementations import this to push events to the renderer.
 */
export const ipcHandlerContext = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    emitConnectionData: (_data: number[]): void => {},
    emitConnectionDisconnected: (): void => {},
}

/**
 * Remove all registered IPC handlers. Useful for cleanup/testing.
 */
export function removeIpcHandlers(): void {
    for (const channel of Object.values(IpcChannels)) {
        ipcMain.removeHandler(channel)
    }
}
