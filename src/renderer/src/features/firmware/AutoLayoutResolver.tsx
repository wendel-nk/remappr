// pattern-check: skip — effect-driven runtime lookup with banner UI; single caller
import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

import type { KeyboardService } from '@firmware'
import useConnectionStore from '@/stores/connectionStore'
import useKeymapStore from '@/stores/keymapStore'
import useUserSettingsStore from '@/stores/userSettingsStore'
import { Button } from '@/ui/button'
import { cacheKey, saveCached } from '@firmware/qmk/layoutSideload'
import { findDef, type LookupStatus } from '@firmware/qmk/viaRegistry'

const dbg = (...args: unknown[]): void => {
    if (import.meta.env.DEV) console.log('[AutoLayoutResolver]', ...args)
}

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

type RunPlan =
    | { run: false; reason: string }
    | { run: true; vid: number; pid: number; name: string | undefined }

function shouldRunAutoLayout(
    service: KeyboardService | null,
    autoLoadLayout: boolean,
): RunPlan {
    if (!service) return { run: false, reason: 'no service' }
    if (!service.capabilities.layoutSideloadable)
        return { run: false, reason: '!layoutSideloadable' }
    if (!autoLoadLayout)
        return { run: false, reason: 'autoLoadLayout disabled' }
    if (!service.applyLayout) return { run: false, reason: '!applyLayout' }
    const { vid, pid, name } = service.deviceInfo
    if (vid === undefined || pid === undefined)
        return { run: false, reason: 'vid/pid missing' }
    return { run: true, vid, pid, name }
}

function deviceKey(service: KeyboardService | null): string | null {
    if (!service) return null
    const { vid, pid } = service.deviceInfo
    if (vid === undefined || pid === undefined) return null
    return `${vid.toString(16)}:${pid.toString(16)}`
}

export function AutoLayoutResolver(): JSX.Element | null {
    const service = useConnectionStore((s) => s.service)
    const setKeymap = useKeymapStore((s) => s.setKeymap)
    const autoLoadLayout = useUserSettingsStore((s) => s.autoLoadLayout)
    const [status, setStatus] = useState<LookupStatus | null>(null)
    const [applying, setApplying] = useState(false)
    const [done, setDone] = useState<'hit' | 'miss' | 'error' | null>(null)
    const [dismissedKey, setDismissedKey] = useState<string | null>(null)

    const currentKey = deviceKey(service)
    const dismissed = dismissedKey !== null && dismissedKey === currentKey

    useEffect(() => {
        const plan = shouldRunAutoLayout(service, autoLoadLayout)
        if (!plan.run) {
            dbg('skip:', plan.reason)
            if (!service) {
                /* eslint-disable react-hooks/set-state-in-effect */
                setStatus(null)
                setDone(null)
                setDismissedKey(null)
                /* eslint-enable react-hooks/set-state-in-effect */
            }
            return
        }
        dbg(
            'running for',
            plan.vid.toString(16),
            plan.pid.toString(16),
            plan.name,
        )
        setStatus(null)
        setDone(null)

        const key = cacheKey(service!.deviceInfo)
        const cached = (() => {
            if (!key) return false
            try {
                return !!window.localStorage.getItem(key)
            } catch {
                return false
            }
        })()
        if (cached) {
            setStatus({ phase: 'cache-hit' })
            setDone('hit')
            return
        }

        let cancelled = false
        ;(async () => {
            const def = await findDef(plan.vid, plan.pid, plan.name, (s) => {
                if (!cancelled) setStatus(s)
            })
            if (cancelled) return
            if (def && service!.applyLayout) {
                setApplying(true)
                try {
                    await service!.applyLayout(def)
                    if (key) saveCached(key, def)
                    const km = await service!.getKeymap()
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
                    onClick={(): void => setDismissedKey(currentKey)}
                    aria-label="Dismiss"
                    className="h-6 w-6"
                >
                    <X className="h-4 w-4" />
                </Button>
            ) : null}
        </div>
    )
}
