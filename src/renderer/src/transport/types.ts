// pattern-check: skip — extracting existing TransportFactory type from ConnectModal into transport layer, no new logic
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
 * Unified transport factory interface used by ConnectModal and StartPage.
 * Each transport provides either a direct `connect` (browser Web APIs)
 * or a `pick_and_connect` with device listing (Tauri/Electron native).
 */
export type TransportFactory = {
    label: string
    communication: 'serial' | 'ble'
    isWireless?: boolean
    connect?: () => Promise<Transport>
    pick_and_connect?: {
        list: () => Promise<Array<AvailableDevice>>
        connect: (dev: AvailableDevice) => Promise<Transport>
    }
    /**
     * Optional: trigger the browser/OS chooser to grant access to a new
     * device, then connect to it. Used by Web Serial / Web BLE where the
     * granted-device list (pick_and_connect.list) is empty until the user
     * has gone through the native chooser at least once.
     */
    request_new?: () => Promise<Transport>
}
