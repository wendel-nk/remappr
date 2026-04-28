import { PhysicalLayout } from '@zmkfirmware/zmk-studio-ts-client/keymap'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { LockState } from '@zmkfirmware/zmk-studio-ts-client/core'
import useConnectionStore from '@/stores/connectionStore'
import { callRpc } from '@firmware/zmk/rpc/rpcCall'

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
            setLayouts(undefined)

            try {
                const response = await callRpc({
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
