import { useEffect, useState } from 'react'
import useConnectionStore from '@/stores/connectionStore'
import { fetchAllBehaviors } from '@firmware/zmk/rpc/rpcBehaviorService'
import type { BehaviorMap } from '@/lib/behaviors/types'

export function useBehaviors(): BehaviorMap {
    const { service, lockState } = useConnectionStore()
    const [behaviors, setBehaviors] = useState<BehaviorMap>({})

    useEffect((): void | (() => void) => {
        if (!service || lockState !== 'unlocked') {
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
    }, [service, lockState])

    return behaviors
}
