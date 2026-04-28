// pattern-check: skip mechanical port — useLayout now reads from service.getPhysicalLayouts() and uses neutral PhysicalLayout
import type { PhysicalLayout } from '@firmware/types'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import useConnectionStore from '@/stores/connectionStore'

interface UseLayoutsReturn {
    layouts: PhysicalLayout[] | undefined
    setLayouts: Dispatch<SetStateAction<PhysicalLayout[] | undefined>>
    selectedPhysicalLayoutIndex: number
    setSelectedPhysicalLayoutIndex: Dispatch<SetStateAction<number>>
}

export function useLayout(): UseLayoutsReturn {
    const { service, lockState } = useConnectionStore()

    const [layouts, setLayouts] = useState<PhysicalLayout[] | undefined>(
        undefined,
    )
    const [selectedPhysicalLayoutIndex, setSelectedPhysicalLayoutIndex] =
        useState<number>(0)

    useEffect((): void | (() => void) => {
        if (!service || lockState !== 'unlocked') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLayouts(undefined)
            return
        }

        let isCancelled = false

        const fetchLayouts = async (): Promise<void> => {
            setLayouts(undefined)

            try {
                const got = await service.getPhysicalLayouts()
                if (!isCancelled) {
                    setLayouts(got.layouts)
                    setSelectedPhysicalLayoutIndex(got.activeLayoutId)
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
    }, [service, lockState])

    return {
        layouts,
        setLayouts,
        selectedPhysicalLayoutIndex,
        setSelectedPhysicalLayoutIndex,
    }
}
