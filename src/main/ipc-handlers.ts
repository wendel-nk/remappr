/**
 * Main process IPC handler registration.
 * Registers all ipcMain.handle() handlers for request/response channels.
 * Each handler validates its input before processing.
 *
 * The actual device communication logic will be implemented in separate modules.
 * This file provides the handler registration pattern and placeholder implementations.
 */

import { type BrowserWindow, ipcMain } from 'electron'
import {
    type BleDiscoveryPayload,
    IpcChannels,
    IpcEvents,
} from '../shared/ipc-types'
import { createLogger } from '../shared/logger'
import { validateAvailableDevice, validateUint8Array } from './ipc-validation'
import {
    connectSerial,
    disconnectSerial,
    listSerialDevices,
    writeSerial,
} from './serial'
import {
    connectGattDevice,
    disconnectGattDevice,
    hasActiveBluezConnection,
    listGattDevices,
    writeGatt,
} from './bluez'
import {
    connectMacosBleDevice,
    disconnectMacosBleDevice,
    hasActiveMacosBleConnection,
    listMacosBleDevices,
    writeMacosBle,
} from './macos-ble'
import {
    connectWindowsBleDevice,
    disconnectWindowsBleDevice,
    hasActiveWindowsBleConnection,
    listWindowsBleDevices,
    writeWindowsBle,
} from './windows-ble'
import {
    connectHidDevice,
    disconnectHidDevice,
    hasActiveHidConnection,
    type HidDiscoveryFilter,
    listHidDevices,
    writeHid,
} from './hid'
import { registerSecretHandlers } from './secret-store'
import { registerGithubArtifactHandler } from './github-artifact'

const log = createLogger('ipc')

// pattern-check: skip — local IPC payload validator, no abstraction.
interface DiscoveryPayload {
    adapterId?: unknown
    serviceUuid?: unknown
    charUuid?: unknown
}

// pattern-check: skip — local IPC payload validator, no abstraction.
function parseDiscovery(arg: unknown): BleDiscoveryPayload | null {
    if (!arg || typeof arg !== 'object') return null
    const a = arg as DiscoveryPayload
    if (typeof a.adapterId !== 'string' || !a.adapterId) return null
    if (typeof a.serviceUuid !== 'string' || !a.serviceUuid) return null
    if (typeof a.charUuid !== 'string' || !a.charUuid) return null
    return {
        adapterId: a.adapterId,
        serviceUuid: a.serviceUuid,
        charUuid: a.charUuid,
    }
}

// Keep the IPC surface bounded and validate every renderer-supplied endpoint.
function parseDiscoveries(arg: unknown): BleDiscoveryPayload[] {
    if (!arg || typeof arg !== 'object') return []
    const raw = (arg as { endpoints?: unknown }).endpoints
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 16) return []
    const parsed = raw.map(parseDiscovery)
    if (parsed.some((d) => d === null)) return []
    return parsed as BleDiscoveryPayload[]
}

// pattern-check: skip — local IPC payload validator, no abstraction.
function parseHidFilter(raw: unknown): HidDiscoveryFilter | null {
    if (!raw || typeof raw !== 'object') return null
    const f = raw as Record<string, unknown>
    const out: HidDiscoveryFilter = {}
    if (Array.isArray(f.vendorIds)) {
        out.vendorIds = f.vendorIds.filter(
            (v): v is number => typeof v === 'number',
        )
    }
    if (typeof f.usagePage === 'number') out.usagePage = f.usagePage
    if (typeof f.usage === 'number') out.usage = f.usage
    return out
}

// pattern-check: skip — local IPC payload validator, no abstraction.
function parseHidDiscovery(arg: unknown): HidDiscoveryFilter[] {
    if (!arg || typeof arg !== 'object') return []
    const a = arg as Record<string, unknown>
    if (!Array.isArray(a.filters)) return []
    return a.filters
        .map(parseHidFilter)
        .filter((f): f is HidDiscoveryFilter => f !== null)
}

// Tracks which transport currently owns send/close. Set when a transport
// connects, cleared on disconnect/error. Lets TRANSPORT_SEND_DATA and
// TRANSPORT_CLOSE route to whichever transport is active.
type ActiveKind =
    | 'serial'
    | 'bluez'
    | 'macos-ble'
    | 'windows-ble'
    | 'hid'
    | null
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
export function registerIpcHandlers(getWindows: () => BrowserWindow[]): void {
    // pattern-check: skip — add one registration call, no logic change
    // --- Secret storage (safeStorage-backed) ---
    registerSecretHandlers()
    // --- GitHub artifact download proxy (dodges renderer CORS) ---
    registerGithubArtifactHandler()

    // --- Serial Device Handlers ---

    ipcMain.handle(IpcChannels.SERIAL_LIST_DEVICES, async () => {
        return await listSerialDevices()
    })

    ipcMain.handle(IpcChannels.SERIAL_CONNECT, async (_, device: unknown) => {
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
    })

    ipcMain.handle(IpcChannels.SERIAL_DISCONNECT, async () => {
        await disconnectSerial()
        if (activeKind === 'serial') activeKind = null
    })

    // --- BLE Device Handlers ---
    // BLE scan coordination (start-scan, stop-scan, select-device) is
    // registered in ble-manager.ts via registerBleIpcHandlers().

    // --- BlueZ direct handlers (Linux) ---

    ipcMain.handle(IpcChannels.BLUEZ_LIST_DEVICES, async (_, arg: unknown) => {
        const endpoints = parseDiscoveries(arg)
        if (endpoints.length === 0) return []
        return await listGattDevices(endpoints)
    })

    ipcMain.handle(IpcChannels.BLUEZ_CONNECT, async (_, arg: unknown) => {
        const a = arg as { devicePath?: unknown }
        const devicePath = a?.devicePath
        if (typeof devicePath !== 'string' || !devicePath) {
            return { ok: false, error: 'Invalid device path' }
        }
        const endpoints = parseDiscoveries(arg)
        if (endpoints.length === 0) {
            return { ok: false, error: 'Invalid discovery payload' }
        }
        try {
            const connected = await connectGattDevice(devicePath, endpoints, {
                onData: (data) => ipcHandlerContext.emitConnectionData(data),
                onDisconnected: () => {
                    activeKind = null
                    ipcHandlerContext.emitConnectionDisconnected()
                },
            })
            activeKind = 'bluez'
            return {
                ok: true,
                label: connected.label,
                firmwareAdapterId: connected.firmwareAdapterId,
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            log.error('BLUEZ_CONNECT failed:', msg)
            return { ok: false, error: msg }
        }
    })

    // --- Native CoreBluetooth direct handlers (macOS) ---

    ipcMain.handle(
        IpcChannels.MACOS_BLE_LIST_DEVICES,
        async (_, arg: unknown) => {
            const endpoints = parseDiscoveries(arg)
            if (endpoints.length === 0) return []
            return await listMacosBleDevices(endpoints)
        },
    )

    ipcMain.handle(IpcChannels.MACOS_BLE_CONNECT, async (_, arg: unknown) => {
        const a = arg as { deviceId?: unknown }
        const deviceId = a?.deviceId
        if (typeof deviceId !== 'string' || !deviceId) {
            return { ok: false, error: 'Invalid CoreBluetooth device ID' }
        }
        const endpoints = parseDiscoveries(arg)
        if (endpoints.length === 0) {
            return { ok: false, error: 'Invalid discovery payload' }
        }
        try {
            const connected = await connectMacosBleDevice(deviceId, endpoints, {
                onData: (data) => ipcHandlerContext.emitConnectionData(data),
                onDisconnected: () => {
                    activeKind = null
                    ipcHandlerContext.emitConnectionDisconnected()
                },
            })
            activeKind = 'macos-ble'
            return { ok: true, ...connected }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            log.error('MACOS_BLE_CONNECT failed:', msg)
            return { ok: false, error: msg }
        }
    })

    // --- Native WinRT Bluetooth direct handlers (Windows) ---

    ipcMain.handle(
        IpcChannels.WINDOWS_BLE_LIST_DEVICES,
        async (_, arg: unknown) => {
            const endpoints = parseDiscoveries(arg)
            if (endpoints.length === 0) return []
            return await listWindowsBleDevices(endpoints)
        },
    )

    ipcMain.handle(IpcChannels.WINDOWS_BLE_CONNECT, async (_, arg: unknown) => {
        const a = arg as { deviceId?: unknown }
        const deviceId = a?.deviceId
        if (typeof deviceId !== 'string' || !deviceId) {
            return { ok: false, error: 'Invalid Windows Bluetooth device ID' }
        }
        const endpoints = parseDiscoveries(arg)
        if (endpoints.length === 0) {
            return { ok: false, error: 'Invalid discovery payload' }
        }
        try {
            const connected = await connectWindowsBleDevice(
                deviceId,
                endpoints,
                {
                    onData: (data) =>
                        ipcHandlerContext.emitConnectionData(data),
                    onDisconnected: () => {
                        activeKind = null
                        ipcHandlerContext.emitConnectionDisconnected()
                    },
                },
            )
            activeKind = 'windows-ble'
            return { ok: true, ...connected }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            log.error('WINDOWS_BLE_CONNECT failed:', msg)
            return { ok: false, error: msg }
        }
    })

    ipcMain.handle(IpcChannels.GET_PLATFORM, async () => process.platform)

    // --- HID handlers (raw USB HID via node-hid) ---

    ipcMain.handle(IpcChannels.HID_LIST_DEVICES, async (_, arg: unknown) => {
        const filters = parseHidDiscovery(arg)
        return await listHidDevices(filters)
    })

    ipcMain.handle(IpcChannels.HID_CONNECT, async (_, arg: unknown) => {
        const a = arg as { device?: { id?: unknown; label?: unknown } }
        const path =
            a?.device && typeof a.device.id === 'string' ? a.device.id : null
        if (!path) return { ok: false, error: 'Invalid HID device path' }
        try {
            const label = await connectHidDevice(path, {
                onData: (data) => ipcHandlerContext.emitConnectionData(data),
                onDisconnected: () => {
                    activeKind = null
                    ipcHandlerContext.emitConnectionDisconnected()
                },
            })
            activeKind = 'hid'
            return { ok: true, label }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            log.error('HID_CONNECT failed:', msg)
            return { ok: false, error: msg }
        }
    })

    // --- Transport Handlers (route via activeKind) ---

    ipcMain.handle(
        IpcChannels.TRANSPORT_SEND_DATA,
        async (_, data: unknown) => {
            const validData = validateUint8Array(data)
            if (activeKind === 'bluez') {
                await writeGatt(validData)
            } else if (activeKind === 'macos-ble') {
                await writeMacosBle(validData)
            } else if (activeKind === 'windows-ble') {
                await writeWindowsBle(validData)
            } else if (activeKind === 'hid') {
                await writeHid(validData)
            } else {
                await writeSerial(validData)
            }
        },
    )

    ipcMain.handle(IpcChannels.TRANSPORT_CLOSE, async () => {
        if (activeKind === 'bluez' || hasActiveBluezConnection()) {
            await disconnectGattDevice()
        } else if (
            activeKind === 'macos-ble' ||
            hasActiveMacosBleConnection()
        ) {
            await disconnectMacosBleDevice()
        } else if (
            activeKind === 'windows-ble' ||
            hasActiveWindowsBleConnection()
        ) {
            await disconnectWindowsBleDevice()
        } else if (activeKind === 'hid' || hasActiveHidConnection()) {
            await disconnectHidDevice()
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
