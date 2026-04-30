// Pattern check: no GoF pattern (-) — rejected — refactor hook to consume catalog from connectionStore instead of legacy keyboards import; data source swap.
import { useEffect, useMemo, useState } from 'react'
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
    const [activeTab, setActiveTab] = useState('0')
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

    useEffect(() => {
        if (!searchQuery.trim()) return
        const currentTabIndex = parseInt(activeTab)
        const currentPage = pagesWithMatches[currentTabIndex]
        if (currentPage && !currentPage.hasMatches) {
            const firstEnabledTab = pagesWithMatches.find((k) => k.hasMatches)
            if (firstEnabledTab) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setActiveTab(firstEnabledTab.index.toString())
            }
        }
    }, [searchQuery, activeTab, pagesWithMatches])

    return {
        searchQuery,
        setSearchQuery,
        activeTab,
        setActiveTab,
        pages,
        pagesWithMatches,
    }
}
