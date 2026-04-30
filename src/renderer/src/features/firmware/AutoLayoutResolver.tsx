// Pattern check: no GoF pattern (-) — rejected — effect-driven runtime lookup with banner UI; small component, single caller.
import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

import useConnectionStore from '@/stores/connectionStore'
import useKeymapStore from '@/stores/keymapStore'
import useUserSettingsStore from '@/stores/userSettingsStore'
import { Button } from '@/ui/button'
import { cacheKey, saveCached } from '@firmware/qmk/layoutSideload'
import { findDef, type LookupStatus } from '@firmware/qmk/viaRegistry'

function statusLine(s: LookupStatus): string {
    switch (s.phase) {
        case 'cache-hit':
            return 'Layout loaded from cache'
        case 'listing':
            return `Listing ${s.repo}@${s.branch}…`
        case 'scanning':
            return `Scanning ${s.repo}@${s.branch} (${s.processed}/${s.total})…`
        case 'hit':
            return `Found: ${s.name}`
        case 'miss':
            return 'No matching layout in registry'
        case 'error':
            return `Lookup error: ${s.message}`
    }
}

export function AutoLayoutResolver(): JSX.Element | null {
    const { service } = useConnectionStore()
    const setKeymap = useKeymapStore((s) => s.setKeymap)
    const autoLoadLayout = useUserSettingsStore((s) => s.autoLoadLayout)
    const [status, setStatus] = useState<LookupStatus | null>(null)
    const [applying, setApplying] = useState(false)
    const [done, setDone] = useState<'hit' | 'miss' | 'error' | null>(null)
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        if (!service) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStatus(null)
            setDone(null)
            setDismissed(false)
            return
        }
        if (!service.capabilities.layoutSideloadable) {
            console.log('[AutoLayoutResolver] skip: !layoutSideloadable')
            return
        }
        if (!autoLoadLayout) {
            console.log('[AutoLayoutResolver] skip: autoLoadLayout disabled')
            return
        }
        if (!service.applyLayout) {
            console.log('[AutoLayoutResolver] skip: !applyLayout')
            return
        }
        if (
            service.deviceInfo.vid === undefined ||
            service.deviceInfo.pid === undefined
        ) {
            console.log(
                '[AutoLayoutResolver] skip: vid/pid missing',
                service.deviceInfo,
            )
            return
        }
        console.log(
            '[AutoLayoutResolver] running for',
            service.deviceInfo.vid.toString(16),
            service.deviceInfo.pid.toString(16),
            service.deviceInfo.name,
        )

        const cached = (() => {
            const key = cacheKey(service.deviceInfo)
            if (!key) return false
            try {
                const raw = window.localStorage.getItem(key)
                return !!raw
            } catch {
                return false
            }
        })()
        if (cached) {
            // Adapter already applied cached def at connect time. Surface a
            // banner so the user sees the layout came from cache, with a
            // dismiss button.
            setStatus({ phase: 'cache-hit' })
            setDone('hit')
            return
        }

        let cancelled = false
        ;(async () => {
            const def = await findDef(
                service.deviceInfo.vid!,
                service.deviceInfo.pid!,
                service.deviceInfo.name,
                (s) => {
                    if (!cancelled) setStatus(s)
                },
            )
            if (cancelled) return
            if (def && service.applyLayout) {
                setApplying(true)
                try {
                    await service.applyLayout(def)
                    const key = cacheKey(service.deviceInfo)
                    if (key) saveCached(key, def)
                    const km = await service.getKeymap()
                    setKeymap(km)
                    setDone('hit')
                    toast.success(`Layout loaded: ${def.name}`)
                } catch (err) {
                    setDone('error')
                    toast.error(
                        `Failed to apply layout: ${(err as Error).message}`,
                    )
                } finally {
                    setApplying(false)
                }
            } else {
                setDone('miss')
            }
        })()
        return () => {
            cancelled = true
        }
    }, [service, setKeymap, autoLoadLayout])

    if (!service?.capabilities.layoutSideloadable) return null
    if (dismissed) return null
    if (!status && !done) return null

    const isSearching = !done

    return (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-md border bg-card px-3 py-2 shadow-md text-sm">
            {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            <span>
                {done === 'miss'
                    ? 'No layout found in registry. Use “Load layout JSON” to upload.'
                    : done === 'error'
                      ? 'Layout lookup failed. Try uploading manually.'
                      : applying
                        ? 'Applying layout (reading keymap)…'
                        : (status && statusLine(status)) || 'Searching…'}
            </span>
            {!isSearching ? (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDismissed(true)}
                    aria-label="Dismiss"
                    className="h-6 w-6"
                >
                    <X className="h-4 w-4" />
                </Button>
            ) : null}
        </div>
    )
}
