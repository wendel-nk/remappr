import { useEffect, useState } from 'react'
import { LockState } from '@zmkfirmware/zmk-studio-ts-client/core'
import type { GetBehaviorDetailsResponse } from '@zmkfirmware/zmk-studio-ts-client/behaviors'
import useConnectionStore from '@/stores/connectionStore'
import { callRpc } from '@/services/rpcCall'
import type { BehaviorMap } from '@/lib/behaviors/types'

export function useBehaviors(): BehaviorMap {
    const { connection, lockState } = useConnectionStore()
    const [behaviors, setBehaviors] = useState<BehaviorMap>({})

    useEffect((): void | (() => void) => {
        if (
            !connection ||
            lockState !== LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED
        ) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setBehaviors({})
            return
        }

        let isCancelled = false

        const fetchBehaviors = async (): Promise<void> => {
            setBehaviors({})

            try {
                const listRequest = {
                    behaviors: { listAllBehaviors: true },
                    requestId: 0,
                }

                const behaviorListResponse = await callRpc(listRequest)
                if (isCancelled) return

                const behaviorMap: BehaviorMap = {}
                const behaviorIds =
                    behaviorListResponse?.behaviors?.listAllBehaviors
                        ?.behaviors || []

                for (const behaviorId of behaviorIds) {
                    if (isCancelled) break

                    const detailsRequest = {
                        behaviors: { getBehaviorDetails: { behaviorId } },
                        requestId: 0,
                    }

                    const detailsResponse = await callRpc(detailsRequest)
                    const details: GetBehaviorDetailsResponse | undefined =
                        detailsResponse?.behaviors?.getBehaviorDetails

                    if (details) {
                        behaviorMap[details.id] = details
                    }
                }

                if (!isCancelled) {
                    setBehaviors(behaviorMap)
                }
            } catch (error) {
                if (!isCancelled) {
                    console.error('Error fetching behaviors:', error)
                    setBehaviors({})
                }
            }
        }

        fetchBehaviors()

        return (): void => {
            isCancelled = true
        }
    }, [connection, lockState])

    return behaviors
}
