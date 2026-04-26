import type { Notification } from '@zmkfirmware/zmk-studio-ts-client/studio'
import React, { SetStateAction, useEffect, useState } from 'react'
import {
    call_rpc,
    create_rpc_connection as createRpcConnection,
    Request,
    RequestResponse,
    RpcConnection,
} from '@zmkfirmware/zmk-studio-ts-client'
import { valueAfter } from '@/lib/async'
import { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import { publish } from '@/hooks/use-pub-sub'
import useConnectionStore from '@/stores/connectionStore.ts'
import { callRemoteProcedureControl } from '@/features/connection/callRemoteProcedureControl.ts'
import { LockState } from '@zmkfirmware/zmk-studio-ts-client/core'

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
        call_rpc(conn, { core: { getDeviceInfo: true } })
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
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setData(undefined)
                return
            }
            console.log(req, response_mapper)

            async function startRequest(): Promise<void> {
                if (!connection) return
                setData(undefined)

                const response = response_mapper(
                    await callRemoteProcedureControl(req),
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
