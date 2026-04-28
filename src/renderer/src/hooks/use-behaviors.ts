// pattern-check: skip mechanical port — fetches BehaviorMap via ZmkKeyboardService.getBehaviors instead of callRpc helper
import { useEffect, useState } from 'react'
import useConnectionStore from '@/stores/connectionStore'
import { ZmkKeyboardService } from '@firmware/zmk/service'
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
                const map = await (service as ZmkKeyboardService).getBehaviors()
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
