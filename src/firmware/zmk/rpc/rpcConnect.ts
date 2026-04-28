// Pattern check: Adapter (Tier 1) — extended — backs src/firmware/adapter.ts FirmwareAdapter; bridges UI connect flow into ZmkAdapter.connect + ZmkKeyboardService.
// pattern-check: skip — drops setConnection parameter, consolidates onto setService; signature simplification only
import {
    call_rpc,
    create_rpc_connection as createRpcConnection,
    RequestResponse,
    RpcConnection,
} from '@zmkfirmware/zmk-studio-ts-client'
import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'

import type { KeyboardService } from '@firmware/service'
import type { DeviceInfo } from '@firmware/types'

import { valueAfter } from '@/lib/async'
import { publish } from '@/hooks/use-pub-sub'
import { rememberConnectedDeviceName } from '@/transport/web-serial'

import { ZmkKeyboardService } from '../service'

type SetService = (
    service: KeyboardService | null,
    communication?: 'serial' | 'ble',
) => void

interface DeviceInfoDetails {
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
    conn: RpcConnection,
): Promise<DeviceInfoDetails | undefined> {
    return await Promise.race([
        call_rpc(conn, { core: { getDeviceInfo: true } })
            .then(
                (response: RequestResponse): DeviceInfoDetails | undefined =>
                    response?.core?.getDeviceInfo as
                        | DeviceInfoDetails
                        | undefined,
            )
            .catch((e: unknown): undefined => {
                console.error('Failed first RPC call', e)
                return undefined
            }),
        valueAfter(undefined, 1000),
    ])
}

export async function connectDevice(
    transport: RpcTransport,
    setService: SetService,
    setConnectedDeviceName: (name: string | null) => void,
    signal: AbortSignal,
    communication: 'serial' | 'ble',
): Promise<void | string> {
    const conn = await createRpcConnection(transport, { signal })

    const details = await probeDeviceInfo(conn)
    if (!details) {
        return 'Failed to connect to the chosen device'
    }

    const deviceInfo: DeviceInfo = {
        name: details.name,
        firmware: 'zmk',
        serialNumber: decodeSerial(details.serialNumber),
    }
    const service = new ZmkKeyboardService(conn, deviceInfo)

    service.subscribe(({ topic, payload }) => {
        publish(`rpc_notification.${topic}`, payload)
    })
    service.onClosed(() => {
        setConnectedDeviceName(null)
        setService(null)
    })

    setConnectedDeviceName(details.name)
    if (communication === 'serial') {
        rememberConnectedDeviceName(details.name)
    }
    setService(service, communication)
}
