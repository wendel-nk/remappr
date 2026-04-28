import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import type { KeyboardService } from './service'
import type { DeviceInfo, TransportKind } from './types'

export interface BleDiscovery {
    serviceUuid: string
    charUuid: string
}

export interface HidDiscovery {
    vendorIds?: number[]
    usagePage?: number
    usage?: number
}

export interface Discovery {
    ble?: BleDiscovery
    hid?: HidDiscovery
    serial?: Record<string, never>
}

export type Probe =
    | { ok: true; deviceInfo: DeviceInfo }
    | { ok: false; reason?: string }

export interface ProbeHint {
    transportKind: TransportKind
}

export interface FirmwareAdapter {
    readonly id: string
    readonly displayName: string
    readonly discovery: Discovery
    canHandle(transport: RpcTransport, hint?: ProbeHint): Promise<Probe>
    connect(
        transport: RpcTransport,
        signal: AbortSignal,
    ): Promise<KeyboardService>
}
