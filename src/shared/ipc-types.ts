/**
 * Shared IPC type definitions for Electron main <-> renderer communication.
 * These types define the contract for all IPC channels and their payloads.
 */

// Re-export transport types used across IPC boundaries
export interface AvailableDevice {
    label: string
    id: string
}

// --- IPC Channel Names ---

/** Request/response channels (renderer invokes, main handles) */
export const IpcChannels = {
    // Serial device operations
    SERIAL_LIST_DEVICES: 'serial:list-devices',
    SERIAL_CONNECT: 'serial:connect',
    SERIAL_DISCONNECT: 'serial:disconnect',

    // BLE device operations
    BLE_LIST_DEVICES: 'ble:list-devices',
    BLE_CONNECT: 'ble:connect',
    BLE_START_SCAN: 'ble:start-scan',
    BLE_STOP_SCAN: 'ble:stop-scan',
    BLE_SELECT_DEVICE: 'ble:select-device',

    // Transport operations (shared by serial & BLE)
    TRANSPORT_SEND_DATA: 'transport:send-data',
    TRANSPORT_CLOSE: 'transport:close',
} as const

/** Event channels (main pushes to renderer) */
export const IpcEvents = {
    CONNECTION_DATA: 'connection:data',
    CONNECTION_DISCONNECTED: 'connection:disconnected',
    BLE_DEVICES_DISCOVERED: 'ble:devices-discovered',
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
export type IpcEvent = (typeof IpcEvents)[keyof typeof IpcEvents]

// --- Payload Types ---

/** Map of invoke channel -> { params, result } */
export interface IpcInvokeMap {
    [IpcChannels.SERIAL_LIST_DEVICES]: {
        params: void
        result: AvailableDevice[]
    }
    [IpcChannels.SERIAL_CONNECT]: {
        params: AvailableDevice
        result: boolean
    }
    [IpcChannels.SERIAL_DISCONNECT]: {
        params: void
        result: void
    }
    [IpcChannels.BLE_LIST_DEVICES]: {
        params: void
        result: AvailableDevice[]
    }
    [IpcChannels.BLE_CONNECT]: {
        params: AvailableDevice
        result: boolean
    }
    [IpcChannels.BLE_START_SCAN]: {
        params: void
        result: void
    }
    [IpcChannels.BLE_STOP_SCAN]: {
        params: void
        result: void
    }
    [IpcChannels.BLE_SELECT_DEVICE]: {
        params: string
        result: boolean
    }
    [IpcChannels.TRANSPORT_SEND_DATA]: {
        params: Uint8Array
        result: void
    }
    [IpcChannels.TRANSPORT_CLOSE]: {
        params: void
        result: void
    }
}

/** Map of event channel -> payload type */
export interface IpcEventMap {
    [IpcEvents.CONNECTION_DATA]: number[]
    [IpcEvents.CONNECTION_DISCONNECTED]: void
    [IpcEvents.BLE_DEVICES_DISCOVERED]: AvailableDevice[]
}

// --- Preload API Surface ---

/**
 * The API exposed to the renderer via contextBridge.
 * Uses simple signatures since contextBridge serializes across the boundary.
 * Type safety at call sites is provided by the typed electron adapter modules.
 */
export interface ElectronIpcApi {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>
    on(
        event: string,
        callback: (...args: unknown[]) => void,
    ): () => void
}
