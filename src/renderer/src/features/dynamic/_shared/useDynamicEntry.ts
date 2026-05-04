// pattern-check: skip — generic cancellable-fetch hook with request-id race guard
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { KeyboardService } from '@firmware'

type Fetcher<T> = (
    service: KeyboardService,
    idx: number,
) => Promise<T> | undefined

export function useDynamicEntry<T>(
    service: KeyboardService | null,
    idx: number,
    opened: boolean,
    fetcher: Fetcher<T>,
    errorLabel: string,
): {
    entry: T | null
    setEntry: React.Dispatch<React.SetStateAction<T | null>>
    loading: boolean
} {
    const [entry, setEntry] = useState<T | null>(null)
    const [loading, setLoading] = useState(false)
    const reqId = useRef(0)
    const serviceRef = useRef<KeyboardService | null>(null)

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        serviceRef.current = service
        if (!service || !opened) return
        const promise = fetcher(service, idx)
        if (!promise) return
        const my = ++reqId.current
        setLoading(true)
        promise
            .then((value) => {
                if (my !== reqId.current) return
                if (serviceRef.current !== service) return
                setEntry(value)
            })
            .catch((e) => {
                if (my !== reqId.current) return
                console.error(e)
                toast.error(`Failed to load ${errorLabel}`)
                setEntry(null)
            })
            .finally(() => {
                if (my === reqId.current) setLoading(false)
            })
        // fetcher and errorLabel are stable across renders by convention.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [service, idx, opened])
    /* eslint-enable react-hooks/set-state-in-effect */

    return { entry, setEntry, loading }
}
