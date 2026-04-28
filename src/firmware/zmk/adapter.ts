// Pattern check: Adapter (Tier 1) — extended — backs src/firmware/adapter.ts FirmwareAdapter; concrete ZMK adapter with BLE discovery + canHandle probe + connect.
import {
    call_rpc,
    create_rpc_connection,
    RpcConnection,
} from '@zmkfirmware/zmk-studio-ts-client'
import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'

import type { Discovery, FirmwareAdapter, Probe } from '@firmware/adapter'
import type { KeyboardService } from '@firmware/service'
import type { DeviceInfo } from '@firmware/types'

import { ZMK_CHAR_UUID, ZMK_SERVICE_UUID } from './ble/constants'
import { ZmkKeyboardService } from './service'

const PROBE_DEADLINE_MS = 750

const ZMK_DISCOVERY: Discovery = {
    ble: {
        serviceUuid: ZMK_SERVICE_UUID,
        charUuid: ZMK_CHAR_UUID,
    },
    serial: {},
}

interface ZmkDeviceInfoPayload {
    name: string
    serialNumber?: Uint8Array
}

function decodeSerial(serial?: Uint8Array): string | undefined {
    if (!serial || serial.length === 0) return undefined
    return Array.from(serial)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

async function probeDeviceInfo(
    connection: RpcConnection,
    deadlineMs: number,
): Promise<ZmkDeviceInfoPayload | undefined> {
    return await Promise.race([
        call_rpc(connection, { core: { getDeviceInfo: true } })
            .then(
                (r) =>
                    r?.core?.getDeviceInfo as ZmkDeviceInfoPayload | undefined,
            )
            .catch(() => undefined),
        new Promise<undefined>((resolve) =>
            setTimeout(() => resolve(undefined), deadlineMs),
        ),
    ])
}

export const zmkAdapter: FirmwareAdapter = {
    id: 'zmk',
    displayName: 'ZMK',
    discovery: ZMK_DISCOVERY,

    async canHandle(transport: RpcTransport): Promise<Probe> {
        const probeAbort = new AbortController()
        const connection = create_rpc_connection(transport, {
            signal: probeAbort.signal,
        })
        try {
            const payload = await probeDeviceInfo(connection, PROBE_DEADLINE_MS)
            if (!payload) {
                return { ok: false, reason: 'no response within deadline' }
            }
            const deviceInfo: DeviceInfo = {
                name: payload.name,
                firmware: 'zmk',
                serialNumber: decodeSerial(payload.serialNumber),
            }
            return { ok: true, deviceInfo }
        } finally {
            probeAbort.abort()
            try {
                connection.notification_readable.cancel().catch(() => undefined)
            } catch {
                // ignore
            }
        }
    },

    async connect(
        transport: RpcTransport,
        signal: AbortSignal,
    ): Promise<KeyboardService> {
        const connection = create_rpc_connection(transport, { signal })
        const payload = await probeDeviceInfo(connection, PROBE_DEADLINE_MS)
        if (!payload) {
            throw new Error('Failed to fetch device info from ZMK device')
        }
        const deviceInfo: DeviceInfo = {
            name: payload.name,
            firmware: 'zmk',
            serialNumber: decodeSerial(payload.serialNumber),
        }
        return new ZmkKeyboardService(connection, deviceInfo)
    },
}
