import type { Notification } from '@zmkfirmware/zmk-studio-ts-client/studio'
import React, { SetStateAction, useEffect, useState } from 'react'
import {
    call_rpc,
    create_rpc_connection as createRpcConnection,
    Request,
    RequestResponse,
    RpcConnection,
} from '@zmkfirmware/zmk-studio-ts-client'
import { valueAfter } from '@/utils/async'
import { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import { publish } from '@/utils/usePubSub'
import useConnectionStore from '@/features/connection/connectionStore.ts'
import { LockState } from '@zmkfirmware/zmk-studio-ts-client/core'

// export async function listenForNotifications(
//     notification_stream: ReadableStream<Notification>,
//     signal: AbortSignal,
//     callback?: (notification: Notification) => void
// ): Promise<void> {
//     const reader = notification_stream.getReader()
//     const onAbort = () => {
//         reader.cancel()
//         reader.releaseLock()
//     }
//     signal.addEventListener('abort', onAbort, { once: true })
//     do {
//     const pub = usePub()
//
//     try {
//         const { done, value } = await reader.read()
//         if (done || !value) return
//         console.log('done value', done, value)
//         console.log('Notification', value)
//         pub('rpc_notification', value)
//
//         const subsystem = Object.entries(value).find(
//             ([, v]) => v !== undefined,
//         )
//         if (!subsystem) return
//
//         const [subId, subData] = subsystem
//         const event = Object.entries(subData).find(([_k, v]) => v !== undefined)
//
//         if (!event) return
//
//         const [eventName, eventData] = event
//         const topic = ['rpc_notification', subId, eventName].join('.')
//         console.log(topic)
//         pub(topic, eventData)
//
//     } catch (e) {
//         console.log(e)
//         signal.removeEventListener('abort', onAbort)
//         reader.releaseLock()
//         toast.error(e.message)
//         throw e
//     }
//     } while (true);
//     // signal.removeEventListener('abort', onAbort)
//     // reader.releaseLock()
//     // notification_stream.cancel()
//
//     let result: any;
//     while (!(result = await reader.read()).done) {
//         callback?.(result.value)
//     }
// }

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
            if (done) {
                break
            }

            if (!value) {
                continue
            }

            console.log('Notification', value)
            publish('rpc_notification', value)

            const subsystem = Object.entries(value).find(
                ([, v]) => v !== undefined,
            )
            if (!subsystem) {
                continue
            }

            const [subId, subData] = subsystem
            const event = Object.entries(subData).find(
                ([, v]) => v !== undefined,
            )

            if (!event) {
                continue
            }

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

export async function callRemoteProcedureControl(
    conn: RpcConnection,
    req: Omit<Request, 'requestId'>,
): Promise<RequestResponse> {
    // console.trace('RPC Request', conn, req);
    // console.log( conn, req )
    return call_rpc(conn, req)
        .then((r: RequestResponse): RequestResponse => {
            // console.log('RPC Response', r);
            return r
        })
        .catch((e: unknown): RequestResponse => {
            // console.log('RPC Error', e);
            console.error('RPC Error', e)
            throw e
        })
}

interface DeviceInfoDetails {
    name: string
    serialNumber?: Uint8Array
}

export async function connect(
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
    console.log('Connect function', conn)
    const details = await Promise.race([
        callRemoteProcedureControl(conn, { core: { getDeviceInfo: true } })
            .then(function (
                response: RequestResponse,
            ): DeviceInfoDetails | undefined {
                console.log(response)
                return response?.core?.getDeviceInfo as
                    | DeviceInfoDetails
                    | undefined
            })
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
    setConnection(conn, communication)
}

export function useConnectedDeviceData<T>(
    req: Omit<Request, 'requestId'>,
    response_mapper: (resp: RequestResponse) => T | undefined,
    requireUnlock?: boolean,
): [T | undefined, React.Dispatch<SetStateAction<T | undefined>>] {
    const { connection, lockState } = useConnectionStore()
    const [data, setData] = useState<T | undefined>(undefined)

    useEffect(
        () => {
            if (
                !connection ||
                (requireUnlock &&
                    lockState != LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED)
            ) {
                setData(undefined)
                return
            }
            console.log(req, response_mapper)

            async function startRequest(): Promise<void> {
                if (!connection) return
                setData(undefined)

                const response = response_mapper(
                    await callRemoteProcedureControl(connection, req),
                )
                console.log(response)
                if (!ignore) {
                    setData(response)
                }
            }

            let ignore = false
            startRequest()

            return (): void => {
                ignore = true
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        requireUnlock
            ? [connection, requireUnlock, lockState]
            : [connection, requireUnlock],
    )

    return [data, setData]
}
