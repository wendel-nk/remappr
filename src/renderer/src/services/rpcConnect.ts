import type { Notification } from '@zmkfirmware/zmk-studio-ts-client/studio'
import {
    call_rpc,
    create_rpc_connection as createRpcConnection,
    RequestResponse,
    RpcConnection,
} from '@zmkfirmware/zmk-studio-ts-client'
import { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import { valueAfter } from '@/lib/async'
import { publish } from '@/hooks/use-pub-sub'
import { rememberConnectedDeviceName } from '@/transport/web-serial'

interface DeviceInfoDetails {
    name: string
    serialNumber?: Uint8Array
}

async function listenForNotifications(
    notification_stream: ReadableStream<Notification>,
    signal: AbortSignal,
): Promise<void> {
    const reader = notification_stream.getReader()
    const onAbort = (): void => {
        reader.cancel()
        reader.releaseLock()
    }
    signal.addEventListener('abort', onAbort, { once: true })
    do {
        try {
            const { done, value } = await reader.read()
            if (done) break
            if (!value) continue

            publish('rpc_notification', value)

            const subsystem = Object.entries(value).find(
                ([, v]) => v !== undefined,
            )
            if (!subsystem) continue

            const [subId, subData] = subsystem
            const event = Object.entries(subData).find(
                ([, v]) => v !== undefined,
            )
            if (!event) continue

            const [eventName, eventData] = event
            const topic = ['rpc_notification', subId, eventName].join('.')
            publish(topic, eventData)
        } catch (e) {
            signal.removeEventListener('abort', onAbort)
            reader.releaseLock()
            throw e
        }
        // eslint-disable-next-line no-constant-condition
    } while (true)

    signal.removeEventListener('abort', onAbort)
    reader.releaseLock()
    notification_stream.cancel()
}

export async function connectDevice(
    transport: RpcTransport,
    setConnection: (
        conn: RpcConnection | null,
        communication?: 'serial' | 'ble',
    ) => void,
    setConnectedDeviceName: (name: string | null) => void,
    signal: AbortSignal,
    communication: 'serial' | 'ble',
): Promise<void | string> {
    const conn = await createRpcConnection(transport, { signal })

    const details = await Promise.race([
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

    if (!details) {
        return 'Failed to connect to the chosen device'
    }

    listenForNotifications(conn.notification_readable, signal)
        .then((): void => {
            setConnectedDeviceName(null)
            setConnection(null)
        })
        .catch((e: unknown): void => {
            setConnectedDeviceName(null)
            console.log('connection lost', e)
            setConnection(null)
        })

    setConnectedDeviceName(details.name)
    if (communication === 'serial') {
        rememberConnectedDeviceName(details.name)
    }
    setConnection(conn, communication)
}
