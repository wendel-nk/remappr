import { useEffect, useState } from 'react'
import { LockState } from '@zmkfirmware/zmk-studio-ts-client/core'
import useConnectionStore from '@/stores/connectionStore'
import { fetchAllBehaviors } from '@/services/rpcBehaviorService'
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

        let cancelled = false
        ;(async () => {
            setBehaviors({})
            try {
                const map = await fetchAllBehaviors(() => cancelled)
                if (!cancelled) setBehaviors(map)
            } catch (error) {
                if (!cancelled) {
                    console.error('Error fetching behaviors:', error)
                    setBehaviors({})
                }
            }
        })()

        return (): void => {
            cancelled = true
        }
    }, [connection, lockState])

    return behaviors
}
