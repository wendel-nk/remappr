// Pattern check: no GoF pattern (-) — rejected — picker rewrite to iterate catalog pages + use codec for canonical↔value translation; replaces legacy keyboards import flow.
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Key } from 'react-aria-components'
import { hidUsagePageAndIdFromUsage } from '@/lib/actions/hidUsages'
import {
    maskMods,
    filterKeysBySearch,
    splitKeysByPosition,
    calculateContainerHeight,
    maxBottomForPositioned,
} from '@/lib/keymap/keycodeGrid'
import { useKeycodeFilter } from '@/hooks/use-keycode-filter'
import useConnectionStore from '@/stores/connectionStore'
import type { CatalogEntry } from '@firmware/catalog/types'
import KeycodeButton from './KeycodeButton.tsx'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/tabs'
import { Input } from '@/ui/input'

interface KeycodePickerGridProps {
    value?: number
    label?: string
    highlightedKeys?: number[]
    onValueChanged?: (value?: number) => void
}

const CONTAINER_MAX_HEIGHT = 350

const KEYBOARD_PAGE = 7
const MOD_ID_LOW = 0xe0
const MOD_ID_HIGH = 0xe7

function isModifierKey(page: number, id: number): boolean {
    return page === KEYBOARD_PAGE && id >= MOD_ID_LOW && id <= MOD_ID_HIGH
}

function idToModBit(id: number): number {
    return 1 << (id - MOD_ID_LOW)
}

function emitFromState(
    base: number | undefined,
    flags: number,
): number | undefined {
    if (base !== undefined) return base | (flags << 24)
    if (flags === 0) return undefined
    for (let i = 0; i < 8; i++) {
        const bit = 1 << i
        if (flags & bit) {
            const baseHid = (KEYBOARD_PAGE << 16) | (MOD_ID_LOW + i)
            return baseHid | ((flags & ~bit) << 24)
        }
    }
    return undefined
}

export function KeycodePickerGrid({
    value,
    onValueChanged,
    highlightedKeys,
}: KeycodePickerGridProps): JSX.Element {
    const {
        searchQuery,
        setSearchQuery,
        activeTab,
        setActiveTab,
        pages,
        pagesWithMatches,
    } = useKeycodeFilter()

    const codec = useConnectionStore((s) => s.service?.codec)

    const [modFlags, setModFlags] = useState<number>(0)
    const [baseKey, setBaseKey] = useState<number | undefined>(undefined)

    // Build a lookup keyed by encoded numeric value so we can resolve the
    // active page tab from incoming `value` and reuse during render. Falls
    // back to (page<<16)|usage encoding when codec absent (pre-connect).
    const valueByEntryId = useMemo(() => {
        const map = new Map<string, number>()
        if (!codec) return map
        for (const page of pages) {
            for (const entry of page.entries) {
                const enc = codec.encode(entry.id)
                if (enc) map.set(entry.id, enc.value)
            }
        }
        return map
    }, [codec, pages])

    const valueToEntry = useMemo(() => {
        const map = new Map<number, CatalogEntry>()
        for (const page of pages) {
            for (const entry of page.entries) {
                const v = valueByEntryId.get(entry.id)
                if (v !== undefined) map.set(v, entry)
            }
        }
        return map
    }, [pages, valueByEntryId])

    const handleKeySelect = useCallback(
        (e: Key | null) => {
            if (typeof e !== 'number') {
                setBaseKey(undefined)
                setModFlags(0)
                onValueChanged?.(undefined)
                return
            }
            const [page, id] = hidUsagePageAndIdFromUsage(e)
            if (isModifierKey(page, id)) {
                const nextFlags = modFlags ^ idToModBit(id)
                setModFlags(nextFlags)
                onValueChanged?.(emitFromState(baseKey, nextFlags))
                return
            }
            setBaseKey(e)
            onValueChanged?.(emitFromState(e, modFlags))
        },
        [baseKey, modFlags, onValueChanged],
    )

    useEffect(() => {
        /* eslint-disable react-hooks/set-state-in-effect */
        if (value === undefined || value === 0) {
            setBaseKey(undefined)
            setModFlags(0)
            return
        }
        const flags = (value >> 24) & 0xff
        const base = maskMods(value)
        const [page, id] = hidUsagePageAndIdFromUsage(base)
        if (flags === 0 && isModifierKey(page, id)) {
            setModFlags(idToModBit(id))
            setBaseKey(undefined)
        } else {
            setModFlags(flags)
            setBaseKey(base)
        }
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [value])

    useEffect(() => {
        if (value === undefined || value === 0) return
        const masked = maskMods(value)
        const entry = valueToEntry.get(masked)
        if (entry) {
            const idx = pages.findIndex((p) =>
                p.entries.some((e) => e.id === entry.id),
            )
            if (idx >= 0) setActiveTab(idx.toString())
        }
    }, [value, pages, valueToEntry, setActiveTab])

    function isKeySelected(entryValue: number | undefined): boolean {
        if (entryValue === undefined) return false
        const [page, id] = hidUsagePageAndIdFromUsage(entryValue)
        if (isModifierKey(page, id)) {
            return (modFlags & idToModBit(id)) !== 0
        }
        if (baseKey !== undefined && baseKey === entryValue) return true
        if (highlightedKeys?.some((k) => maskMods(k) === entryValue))
            return true
        return false
    }

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center gap-4 mb-4">
                <TabsList className="flex-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {pages.map((page, index) => {
                        const match = pagesWithMatches[index]
                        const isDisabled =
                            searchQuery.trim() !== '' && !match?.hasMatches
                        return (
                            <TabsTrigger
                                key={page.id}
                                value={index.toString()}
                                disabled={isDisabled}
                            >
                                {page.name}
                            </TabsTrigger>
                        )
                    })}
                </TabsList>
                <Input
                    type="text"
                    placeholder="Search keycodes by label..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64 flex-shrink-0 flex"
                />
            </div>

            {pages.map((page, index) => {
                const filteredKeys = filterKeysBySearch(
                    page.entries,
                    searchQuery,
                )
                const { withPositions, withoutPositions } =
                    splitKeysByPosition(filteredKeys)
                const calculatedHeight = calculateContainerHeight(
                    withPositions,
                    withoutPositions,
                )
                const maxBottomPosition = maxBottomForPositioned(withPositions)

                const renderEntry = (
                    entry: CatalogEntry,
                    positioned: boolean,
                ): JSX.Element => {
                    const entryValue = valueByEntryId.get(entry.id)
                    const keyWidth = entry.w ? entry.w / 2 : 50
                    const keyHeight = entry.h ? entry.h / 2 : 50
                    const button = (
                        <KeycodeButton
                            value={entryValue ?? 0}
                            label={entry.label}
                            name={entry.name}
                            aliases={entry.aliases}
                            notes={entry.notes}
                            width={keyWidth}
                            height={keyHeight}
                            x={positioned ? (entry.x ?? 0) / 100 : 0}
                            y={positioned ? (entry.y ?? 0) / 100 : 0}
                            baseKeyValue={entryValue ?? 0}
                            onSelect={handleKeySelect}
                            isSelected={isKeySelected(entryValue)}
                        />
                    )
                    if (positioned) return button
                    return (
                        <div
                            style={{
                                position: 'relative',
                                width: `${keyWidth}px`,
                                height: `${keyHeight}px`,
                                flexShrink: 0,
                            }}
                        >
                            {button}
                        </div>
                    )
                }

                return (
                    <TabsContent
                        key={page.id}
                        value={index.toString()}
                        className="mt-4"
                    >
                        <div
                            className="relative p-6"
                            style={{
                                minHeight: `${Math.min(calculatedHeight, CONTAINER_MAX_HEIGHT)}px`,
                                maxHeight: `${CONTAINER_MAX_HEIGHT}px`,
                                overflowY: 'auto',
                                overflowX: 'hidden',
                            }}
                        >
                            {withPositions.map((entry, keyIndex) => (
                                <div key={`${entry.id}-${keyIndex}`}>
                                    {renderEntry(entry, true)}
                                </div>
                            ))}

                            {withoutPositions.length > 0 && (
                                <div
                                    style={{
                                        position:
                                            withPositions.length > 0
                                                ? 'absolute'
                                                : 'relative',
                                        top:
                                            withPositions.length > 0
                                                ? `${maxBottomPosition + 10}px`
                                                : '0px',
                                        left:
                                            withPositions.length > 0
                                                ? '0px'
                                                : undefined,
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '4px',
                                        width: '100%',
                                        maxWidth: '100%',
                                    }}
                                >
                                    {withoutPositions.map((entry, keyIndex) => (
                                        <div key={`${entry.id}-${keyIndex}`}>
                                            {renderEntry(entry, false)}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {calculatedHeight > CONTAINER_MAX_HEIGHT && (
                                <div
                                    style={{
                                        position: 'relative',
                                        width: '1px',
                                        height: `${calculatedHeight - CONTAINER_MAX_HEIGHT}px`,
                                        pointerEvents: 'none',
                                        opacity: 0,
                                    }}
                                />
                            )}
                        </div>
                    </TabsContent>
                )
            })}
        </Tabs>
    )
}
