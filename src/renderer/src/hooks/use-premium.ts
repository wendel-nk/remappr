// Pattern check: no GoF pattern (-) — rejected — thin React hook wrapping
// hasPremium() with a storage-event listener; no abstraction.
import { useEffect, useState } from 'react'
import {
    hasBuilderAccess,
    getBuilderStage,
    LICENSE_CHANGE_EVENT,
    type BuilderStage,
} from '@/lib/entitlements'

/**
 * Reactive builder-access flag. During the free alpha this is `true` for everyone;
 * once monetization lands it collapses to the premium entitlement (see
 * `hasBuilderAccess`). Re-evaluates when the license key changes in another tab
 * (storage event) or the same tab (LICENSE_CHANGE_EVENT).
 */
// pattern-check: skip — add same-tab license-change listener to existing hook
export function useBuilderAccess(): boolean {
    const [access, setAccess] = useState(hasBuilderAccess)
    useEffect(() => {
        const reeval = (): void => setAccess(hasBuilderAccess())
        const onStorage = (e: StorageEvent): void => {
            if (e.key === null || e.key.includes('license')) reeval()
        }
        window.addEventListener('storage', onStorage)
        // Same-tab updates: setLicenseKey dispatches this (storage fires only cross-tab).
        window.addEventListener(LICENSE_CHANGE_EVENT, reeval)
        return () => {
            window.removeEventListener('storage', onStorage)
            window.removeEventListener(LICENSE_CHANGE_EVENT, reeval)
        }
    }, [])
    return access
}

/** The builder's lifecycle stage (drives the badge label + "free for now" copy). */
export function useBuilderStage(): BuilderStage {
    return getBuilderStage()
}
