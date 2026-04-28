import React, { SetStateAction, useEffect, useState } from 'react'
import { Request, RequestResponse } from '@zmkfirmware/zmk-studio-ts-client'
import { LockState } from '@zmkfirmware/zmk-studio-ts-client/core'
import useConnectionStore from '@/stores/connectionStore'
import { callRpc } from '@firmware/zmk/rpc/rpcCall'

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

            let ignore = false

            async function startRequest(): Promise<void> {
                if (!connection) return
                setData(undefined)
                const response = response_mapper(await callRpc(req))
                if (!ignore) {
                    setData(response)
                }
            }

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
