import { useEffect, useMemo, useState } from 'react'
import { keyboards } from '@/data/keys'
import { filterKeysBySearch } from '@/lib/keymap/keycodeGrid'

interface UseKeycodeFilterResult {
    searchQuery: string
    setSearchQuery: (q: string) => void
    activeTab: string
    setActiveTab: (t: string) => void
    keyboardsWithMatches: { index: number; hasMatches: boolean }[]
}

export function useKeycodeFilter(): UseKeycodeFilterResult {
    const [searchQuery, setSearchQuery] = useState('')
    const [activeTab, setActiveTab] = useState('0')

    const keyboardsWithMatches = useMemo(() => {
        return keyboards.map((keyboard, index) => {
            const filteredKeys = filterKeysBySearch(
                keyboard.UsageIds,
                searchQuery,
            )
            return { index, hasMatches: filteredKeys.length > 0 }
        })
    }, [searchQuery])

    useEffect(() => {
        if (!searchQuery.trim()) return
        const currentTabIndex = parseInt(activeTab)
        const currentKeyboard = keyboardsWithMatches[currentTabIndex]
        if (currentKeyboard && !currentKeyboard.hasMatches) {
            const firstEnabledTab = keyboardsWithMatches.find(
                (k) => k.hasMatches,
            )
            if (firstEnabledTab) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setActiveTab(firstEnabledTab.index.toString())
            }
        }
    }, [searchQuery, activeTab, keyboardsWithMatches])

    return {
        searchQuery,
        setSearchQuery,
        activeTab,
        setActiveTab,
        keyboardsWithMatches,
    }
}
