// pattern-check: skip — extending existing TransportFactory type with optional capability hooks
import type { Transport } from '@firmware'

export interface AvailableDevice {
    label: string
    id: string
}

export interface SerialConnectionState {
    readHandle?: AbortController
    writeHandle?: AbortController
}

export interface ActiveConnection {
    conn?: WritableStreamDefaultWriter<Uint8Array>
}

export interface TransportEventEmitter {
    emit: (event: string, data: unknown) => void
    on: (event: string, callback: (data: unknown) => void) => void
    off: (event: string, callback: (data: unknown) => void) => void
}

/**
 * Unified transport factory interface used by StartPage. Each transport
 * provides either a direct `connect` (browser Web APIs) or a
 * `pick_and_connect` with device listing (Electron native).
 */
export type TransportFactory = {
    label: string
    communication: 'serial' | 'ble' | 'hid'
    isWireless?: boolean
    connect?: () => Promise<Transport>
    pick_and_connect?: {
        list: () => Promise<Array<AvailableDevice>>
        connect: (dev: AvailableDevice) => Promise<Transport>
    }
    /**
     * Trigger the browser/OS chooser to grant access to a new device, then
     * connect. Used by Web Serial / Web HID / Web BLE where the granted list
     * starts empty until the user picks once.
     */
    request_new?: () => Promise<Transport>
    /** Persist a user-supplied display name for a previously seen device. */
    renameDevice?: (device: AvailableDevice, name: string) => void
    /** Revoke browser permission for a paired device (browser only). */
    forgetDevice?: (device: AvailableDevice) => Promise<void>
}
