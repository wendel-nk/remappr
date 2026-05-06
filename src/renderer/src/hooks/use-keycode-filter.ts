// Pattern check: no GoF pattern (-) — rejected — derive active tab instead of set-state-in-effect, single-hook refactor
import { useMemo, useState } from 'react'
import { CATALOG_PAGES } from '@firmware/catalog/pages'
import type { CatalogEntry, CatalogPage } from '@firmware/catalog/types'
import useConnectionStore from '@/stores/connectionStore'
import useDynamicCatalogStore, {
    resolveMacroLabel,
} from '@/stores/dynamicCatalogStore'
import { filterKeysBySearch } from '@/lib/keymap/keycodeGrid'

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
    const dynamicCatalog = useDynamicCatalogStore()

    const pages: CatalogPage[] = useMemo(() => {
        const base = keyCatalog?.pages ?? CATALOG_PAGES
        return base.map((p) =>
            p.id === 'macros'
                ? {
                      ...p,
                      entries: enrichMacroEntries(p.entries, dynamicCatalog),
                  }
                : p,
        )
    }, [keyCatalog, dynamicCatalog])

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
