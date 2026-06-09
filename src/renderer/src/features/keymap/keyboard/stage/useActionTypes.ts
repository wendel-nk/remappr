// pattern-check: skip — action-types fetch effect extracted from KeyboardView
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react'
import type { ActionType } from '@firmware/types'
import type { KeyboardService } from '@firmware/service'

/** Action types for the multi-assign picker + transparent ("clear") lookup. */
export function useActionTypes(service: KeyboardService | null): ActionType[] {
    const [actionTypes, setActionTypes] = useState<ActionType[]>([])
    useEffect(() => {
        if (!service) {
            setActionTypes([])
            return
        }
        let cancelled = false
        service.listActionTypes().then((types) => {
            if (!cancelled) setActionTypes(types)
        })
        return (): void => {
            cancelled = true
        }
    }, [service])
    return actionTypes
}
