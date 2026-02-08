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
