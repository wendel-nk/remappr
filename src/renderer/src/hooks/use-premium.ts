// Pattern check: no GoF pattern (-) — rejected — thin React hook wrapping
// hasPremium() with a storage-event listener; no abstraction.
import { useEffect, useState } from 'react'
import {
    hasPremium,
    hasBuilderAccess,
    getBuilderStage,
    type BuilderStage,
} from '@/lib/entitlements'

/**
 * Reactive premium flag for components. Re-evaluates when the license key changes
 * in another tab (storage event). The env-derived key is build-time constant, so
 * within a tab this only changes after setLicenseKey writes localStorage.
 */
export function usePremium(): boolean {
    const [premium, setPremium] = useState(hasPremium)
    useEffect(() => {
        const onStorage = (e: StorageEvent): void => {
            if (e.key === null || e.key.includes('license')) {
                setPremium(hasPremium())
            }
        }
        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
    }, [])
    return premium
}

/**
 * Reactive builder-access flag. During the free alpha this is `true` for everyone;
 * once monetization lands it collapses to the premium entitlement (see
 * `hasBuilderAccess`). Mirrors `usePremium`'s storage-event reactivity.
 */
export function useBuilderAccess(): boolean {
    const [access, setAccess] = useState(hasBuilderAccess)
    useEffect(() => {
        const onStorage = (e: StorageEvent): void => {
            if (e.key === null || e.key.includes('license')) {
                setAccess(hasBuilderAccess())
            }
        }
        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
    }, [])
    return access
}

/** The builder's lifecycle stage (drives the badge label + "free for now" copy). */
export function useBuilderStage(): BuilderStage {
    return getBuilderStage()
}
