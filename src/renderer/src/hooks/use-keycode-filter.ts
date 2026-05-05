// Pattern check: no GoF pattern (-) — rejected — derive active tab instead of set-state-in-effect, single-hook refactor
import { useMemo, useState } from 'react'
import { CATALOG_PAGES } from '@firmware/catalog/pages'
import type { CatalogPage } from '@firmware/catalog/types'
import useConnectionStore from '@/stores/connectionStore'
import { filterKeysBySearch } from '@/lib/keymap/keycodeGrid'

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

    const pages: CatalogPage[] = useMemo(
        () => keyCatalog?.pages ?? CATALOG_PAGES,
        [keyCatalog],
    )

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
