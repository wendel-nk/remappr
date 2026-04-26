import { PhysicalLayout } from '@zmkfirmware/zmk-studio-ts-client/keymap'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { LockState } from '@zmkfirmware/zmk-studio-ts-client/core'
import type { GetBehaviorDetailsResponse } from '@zmkfirmware/zmk-studio-ts-client/behaviors'
import useConnectionStore from '@/stores/connectionStore'
import useLockStore from '@/stores/lockStateStore'
import { getBehavior, getBehaviors } from '@/services/rpcEventsService.ts'
import { callRemoteProcedureControl } from '@/features/connection/callRemoteProcedureControl.ts'

type BehaviorMap = Record<number, GetBehaviorDetailsResponse>

export function useBehaviors(): BehaviorMap {
    const { connection } = useConnectionStore()
    const { lockState } = useLockStore()
    const [behaviors, setBehaviors] = useState<BehaviorMap>({})

    useEffect((): (() => void) | void => {
        if (
            !connection ||
            lockState != LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED
        ) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setBehaviors({})
            return
        }

        async function startRequest(): Promise<void> {
            setBehaviors({})

            const behaviorListResponse = await getBehaviors()

            if (!ignore) {
                const behaviorMap: BehaviorMap = {}
                for (const behavior of behaviorListResponse.behaviors
                    ?.listAllBehaviors?.behaviors || []) {
                    if (ignore) {
                        break
                    }

                    const behaviorDetails = await getBehavior(behavior)

                    if (behaviorDetails) {
                        behaviorMap[behaviorDetails.id] = behaviorDetails
                    }
                }

                if (!ignore) {
                    setBehaviors(behaviorMap)
                }
            }
        }

        let ignore = false
        startRequest()

        return (): void => {
            ignore = true
        }
    }, [connection, lockState])

    return behaviors
}

interface UseLayoutsReturn {
    layouts: PhysicalLayout[] | undefined
    setLayouts: Dispatch<SetStateAction<PhysicalLayout[] | undefined>>
    selectedPhysicalLayoutIndex: number
    setSelectedPhysicalLayoutIndex: Dispatch<SetStateAction<number>>
}

export function useLayout(): UseLayoutsReturn {
    const { connection, lockState } = useConnectionStore()

    const [layouts, setLayouts] = useState<PhysicalLayout[] | undefined>(
        undefined,
    )
    const [selectedPhysicalLayoutIndex, setSelectedPhysicalLayoutIndex] =
        useState<number>(0)

    useEffect((): void | (() => void) => {
        // Only fetch if there is a connection and the device is unlocked.
        if (
            !connection ||
            lockState !== LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED
        ) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLayouts(undefined)
            return
        }

        let isCancelled = false

        const fetchLayouts = async (): Promise<void> => {
            // Reset layouts before fetching new data.
            setLayouts(undefined)

            try {
                console.log('Fetching layouts:', connection, lockState)
                const response = await callRemoteProcedureControl({
                    keymap: { getPhysicalLayouts: true },
                })

                if (!isCancelled) {
                    const layoutsResponse =
                        response?.keymap?.getPhysicalLayouts?.layouts
                    const activeIndex =
                        response?.keymap?.getPhysicalLayouts
                            ?.activeLayoutIndex ?? 0
                    setLayouts(layoutsResponse)
                    setSelectedPhysicalLayoutIndex(activeIndex)
                }
            } catch (error) {
                if (!isCancelled) {
                    console.error('Failed to fetch layouts:', error)
                    setLayouts(undefined)
                }
            }
        }

        fetchLayouts()

        return (): void => {
            isCancelled = true
        }
    }, [connection, lockState])

    return {
        layouts,
        setLayouts,
        selectedPhysicalLayoutIndex,
        setSelectedPhysicalLayoutIndex,
    }
}
