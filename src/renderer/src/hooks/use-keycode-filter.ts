// Pattern check: no GoF pattern (-) — rejected — derive active tab instead of set-state-in-effect, single-hook refactor
import { useMemo, useState } from 'react'
import { CATALOG_PAGES } from '@firmware/catalog/pages'
import type { CatalogEntry, CatalogPage } from '@firmware/catalog/types'
import type { FirmwareBehaviorFlags } from '@firmware/service'
import useConnectionStore from '@/stores/connectionStore'
import useDynamicCatalogStore, {
    resolveMacroLabel,
} from '@/stores/dynamicCatalogStore'
import { filterKeysBySearch } from '@/lib/keymap/keycodeGrid'

// Canonical-id prefixes whose tiles are gated by Capabilities.behaviors.
// Adapter that explicitly sets the flag to `false` hides the family;
// `undefined` means unspecified → treat as supported (backward compat).
const BEHAVIOR_PREFIX_GATES: ReadonlyArray<{
    flag: keyof FirmwareBehaviorFlags
    prefix: string
}> = [
    { flag: 'capsWord', prefix: 'caps_word.' },
    { flag: 'leader', prefix: 'leader.' },
    { flag: 'autoShift', prefix: 'auto_shift.' },
    { flag: 'swapHands', prefix: 'swap_hands.' },
]

const filterPagesByBehaviorFlags = (
    pages: CatalogPage[],
    flags: FirmwareBehaviorFlags | undefined,
): CatalogPage[] => {
    if (!flags) return pages
    const disabled = BEHAVIOR_PREFIX_GATES.filter(
        ({ flag }) => flags[flag] === false,
    )
    if (disabled.length === 0) return pages
    return pages.map((p) => ({
        ...p,
        entries: p.entries.filter(
            (e) => !disabled.some(({ prefix }) => e.id.startsWith(prefix)),
        ),
    }))
}

// Enrich Macros-page tiles with the user's real macro names from the
// dynamic catalog store (Vial macro contents, future editor labels).
// Falls through unchanged when no overlay exists for an idx.
const enrichMacroEntries = (
    entries: CatalogEntry[],
    state: ReturnType<typeof useDynamicCatalogStore.getState>,
): CatalogEntry[] =>
    entries.map((e) => {
        const m = e.id.match(/^macro\.user\.(\d+)$/)
        if (!m) return e
        const idx = Number(m[1])
        const overlay = resolveMacroLabel(idx, state, e.label)
        if (overlay === e.label) return e
        return { ...e, label: overlay }
    })

// Append ZMK runtime &macro_* / &combo_* behavior tiles to the
// Macros / Combos pages. ZMK is the only adapter that produces these
// today; for QMK / Vial / Keychron the extra arrays are empty so the
// pages are returned unchanged. On ZMK the codec doesn't support the
// static MC_* / COMBO_TOG ids so filterCatalogByCodec drops the pages
// entirely — synthesize them here when extras exist.
const mergeBehaviorEntries = (
    base: CatalogPage[],
    extraMacros: CatalogEntry[],
    extraCombos: CatalogEntry[],
): CatalogPage[] => {
    if (extraMacros.length === 0 && extraCombos.length === 0) return base
    let hasMacros = false
    let hasCombos = false
    const merged = base.map((p) => {
        if (p.id === 'macros') {
            hasMacros = true
            return extraMacros.length > 0
                ? { ...p, entries: [...extraMacros, ...p.entries] }
                : p
        }
        if (p.id === 'combos') {
            hasCombos = true
            return extraCombos.length > 0
                ? { ...p, entries: [...extraCombos, ...p.entries] }
                : p
        }
        return p
    })
    if (!hasMacros && extraMacros.length > 0) {
        merged.push({
            id: 'macros',
            name: 'Macros',
            style: 'flat-grid',
            visible: true,
            entries: extraMacros,
        })
    }
    if (!hasCombos && extraCombos.length > 0) {
        merged.push({
            id: 'combos',
            name: 'Combos',
            style: 'flat-grid',
            visible: true,
            entries: extraCombos,
        })
    }
    return merged
}

interface UseKeycodeFilterResult {
    searchQuery: string
    setSearchQuery: (q: string) => void
    activeTab: string
    setActiveTab: (t: string) => void
    pages: CatalogPage[]
    pagesWithMatches: { index: number; hasMatches: boolean }[]
}

export function useKeycodeFilter(): UseKeycodeFilterResult {
    const [searchQuery, setSearchQuery] = useState('')
    const [userTab, setUserTab] = useState('0')
    const keyCatalog = useConnectionStore((s) => s.keyCatalog)
    const behaviorFlags = useConnectionStore(
        (s) => s.service?.capabilities.behaviors,
    )
    const dynamicCatalog = useDynamicCatalogStore()

    const pages: CatalogPage[] = useMemo(() => {
        const base = keyCatalog?.pages ?? CATALOG_PAGES
        const { extraMacroEntries, extraComboEntries } = dynamicCatalog
        const gated = filterPagesByBehaviorFlags(base, behaviorFlags)
        return mergeBehaviorEntries(
            gated,
            extraMacroEntries,
            extraComboEntries,
        ).map((p) =>
            p.id === 'macros'
                ? {
                      ...p,
                      entries: enrichMacroEntries(p.entries, dynamicCatalog),
                  }
                : p,
        )
    }, [keyCatalog, dynamicCatalog, behaviorFlags])

    const pagesWithMatches = useMemo(() => {
        return pages.map((page, index) => {
            const filtered = filterKeysBySearch(page.entries, searchQuery)
            return { index, hasMatches: filtered.length > 0 }
        })
    }, [pages, searchQuery])

    const activeTab = useMemo(() => {
        const userIndex = parseInt(userTab)
        const maxIndex = pages.length - 1
        const clamped = Math.min(Math.max(0, userIndex), Math.max(0, maxIndex))
        if (!searchQuery.trim()) return clamped.toString()
        const current = pagesWithMatches[clamped]
        if (current?.hasMatches) return clamped.toString()
        const firstMatch = pagesWithMatches.find((k) => k.hasMatches)
        return (firstMatch?.index ?? clamped).toString()
    }, [userTab, searchQuery, pagesWithMatches, pages.length])

    return {
        searchQuery,
        setSearchQuery,
        activeTab,
        setActiveTab: setUserTab,
        pages,
        pagesWithMatches,
    }
}
