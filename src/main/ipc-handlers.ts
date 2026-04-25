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
import {
    listSerialDevices,
    connectSerial,
    disconnectSerial,
    writeSerial,
} from './serial'
import {
    listZmkDevices,
    connectZmkDevice,
    writeZmk,
    disconnectZmkDevice,
    hasActiveBluezConnection,
} from './bluez'
import {
    listNobleDevices,
    connectNobleDevice,
    writeNoble,
    disconnectNobleDevice,
    hasActiveNobleConnection,
} from './noble-ble'

// Tracks which transport currently owns send/close. Set when a transport
// connects, cleared on disconnect/error. Lets TRANSPORT_SEND_DATA and
// TRANSPORT_CLOSE route to whichever transport is active.
type ActiveKind = 'serial' | 'bluez' | 'noble' | null
let activeKind: ActiveKind = null

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
        return await listSerialDevices()
    })

    ipcMain.handle(
        IpcChannels.SERIAL_CONNECT,
        async (_, device: unknown) => {
            const validDevice = validateAvailableDevice(device)
            const ok = await connectSerial(validDevice.id, {
                onData: (data) => ipcHandlerContext.emitConnectionData(data),
                onDisconnected: () => {
                    activeKind = null
                    ipcHandlerContext.emitConnectionDisconnected()
                },
            })
            if (ok) activeKind = 'serial'
            return ok
        },
    )

    ipcMain.handle(IpcChannels.SERIAL_DISCONNECT, async () => {
        await disconnectSerial()
        if (activeKind === 'serial') activeKind = null
    })

    // --- BLE Device Handlers ---
    // BLE scan coordination (start-scan, stop-scan, select-device) is
    // registered in ble-manager.ts via registerBleIpcHandlers().
    // These handlers are retained for API completeness.

    ipcMain.handle(IpcChannels.BLE_LIST_DEVICES, async () => {
        // Device discovery happens via Web Bluetooth + select-bluetooth-device event.
        // The renderer uses BLE_START_SCAN + BLE_DEVICES_DISCOVERED instead.
        return []
    })

    ipcMain.handle(
        IpcChannels.BLE_CONNECT,
        async (_, device: unknown) => {
            const validDevice = validateAvailableDevice(device)
            // BLE connection happens via Web Bluetooth in the renderer.
            console.log(
                `BLE connect (Web Bluetooth): ${validDevice.label}`,
            )
            return true
        },
    )

    // --- BlueZ direct handlers (Linux) ---

    ipcMain.handle(IpcChannels.BLUEZ_LIST_DEVICES, async () => {
        return await listZmkDevices()
    })

    ipcMain.handle(IpcChannels.BLUEZ_CONNECT, async (_, devicePath: unknown) => {
        if (typeof devicePath !== 'string' || !devicePath) {
            return { ok: false, error: 'Invalid device path' }
        }
        try {
            const label = await connectZmkDevice(devicePath, {
                onData: (data) => ipcHandlerContext.emitConnectionData(data),
                onDisconnected: () => {
                    activeKind = null
                    ipcHandlerContext.emitConnectionDisconnected()
                },
            })
            activeKind = 'bluez'
            return { ok: true, label }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            console.error('[ipc] BLUEZ_CONNECT failed:', msg)
            return { ok: false, error: msg }
        }
    })

    ipcMain.handle(IpcChannels.GET_PLATFORM, async () => process.platform)

    // --- Noble direct handlers (Linux, raw HCI) ---

    ipcMain.handle(IpcChannels.NOBLE_LIST_DEVICES, async () => {
        return await listNobleDevices()
    })

    ipcMain.handle(IpcChannels.NOBLE_CONNECT, async (_, deviceId: unknown) => {
        if (typeof deviceId !== 'string' || !deviceId) {
            return { ok: false, error: 'Invalid device id' }
        }
        try {
            const label = await connectNobleDevice(deviceId, {
                onData: (data) => ipcHandlerContext.emitConnectionData(data),
                onDisconnected: () => {
                    activeKind = null
                    ipcHandlerContext.emitConnectionDisconnected()
                },
            })
            activeKind = 'noble'
            return { ok: true, label }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            console.error('[ipc] NOBLE_CONNECT failed:', msg)
            return { ok: false, error: msg }
        }
    })

    // --- Transport Handlers (route via activeKind) ---

    ipcMain.handle(
        IpcChannels.TRANSPORT_SEND_DATA,
        async (_, data: unknown) => {
            const validData = validateUint8Array(data)
            if (activeKind === 'bluez') {
                await writeZmk(validData)
            } else if (activeKind === 'noble') {
                await writeNoble(validData)
            } else {
                await writeSerial(validData)
            }
        },
    )

    ipcMain.handle(IpcChannels.TRANSPORT_CLOSE, async () => {
        if (activeKind === 'bluez' || hasActiveBluezConnection()) {
            await disconnectZmkDevice()
        } else if (activeKind === 'noble' || hasActiveNobleConnection()) {
            await disconnectNobleDevice()
        } else {
            await disconnectSerial()
        }
        activeKind = null
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
