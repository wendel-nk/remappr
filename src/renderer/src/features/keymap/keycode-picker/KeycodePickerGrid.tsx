// Pattern check: no GoF pattern (-) — rejected — picker rewrite to iterate catalog pages + use codec for canonical↔value translation; replaces legacy keyboards import flow.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Key } from 'react-aria-components'
import { toast } from 'sonner'
import { hidUsagePageAndIdFromUsage } from '@/lib/actions/hidUsages'
import {
    filterKeysBySearch,
    groupEntriesIntoSections,
    maskMods,
} from '@/lib/keymap/keycodeGrid'
import { categoryForUsage } from '@/lib/keymap/keyCategory'
import { useKeycodeFilter } from '@/hooks/use-keycode-filter'
import useConnectionStore from '@/stores/connectionStore'
import useUserSettingsStore from '@/stores/userSettingsStore'
import type { CatalogEntry } from '@firmware/catalog/types'
import KeycodeButton from './KeycodeButton.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { Input } from '@/ui/input'

interface KeycodePickerGridProps {
    value?: number
    label?: string
    highlightedKeys?: number[]
    onValueChanged?: (value?: number) => void
    // Fired when the user clicks a tile carrying entry.behaviorRef
    // (ZMK runtime &macro_* / &combo_* tiles). The picker bypasses
    // the slot/value flow and emits the behavior id directly so the
    // caller can switch the bound action type wholesale.
    onActionChosen?: (kind: string) => void
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
    onActionChosen,
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
    const colorMode = useUserSettingsStore((s) => s.colorMode)

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
        <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="@container w-full min-w-0"
        >
            {/* Container-query layout: tabs + search sit on one row in a wide
                surface (bottom sheet) and stack vertically in the narrow inspector
                panel — never forcing a horizontal scrollbar. */}
            <div className="mb-4 flex flex-col gap-2 @lg:flex-row @lg:items-center">
                <TabsList className="flex h-auto min-w-0 flex-wrap @lg:flex-1">
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
                    className="w-full @lg:w-56 @lg:flex-none"
                />
            </div>

            {/* pattern-check: skip — presentational render swap (positioned grid → grouped chip sections); grouping logic is in the pure keycodeGrid helper */}
            {pages.map((page, index) => {
                const filteredKeys = filterKeysBySearch(
                    page.entries,
                    searchQuery,
                )

                const renderChip = (
                    entry: CatalogEntry,
                    keyIndex: number,
                ): JSX.Element => {
                    const entryValue = valueByEntryId.get(entry.id)
                    const behaviorKind = entry.behaviorRef?.kind
                    const displayOnlyClick = entry.displayOnly
                        ? (): void => {
                              toast.info(
                                  `${entry.label} is a sideloaded combo definition — assign it via the .keymap file, not the picker.`,
                              )
                          }
                        : undefined
                    const overrideClick =
                        displayOnlyClick ??
                        (behaviorKind
                            ? () => onActionChosen?.(behaviorKind)
                            : undefined)
                    return (
                        <KeycodeButton
                            key={`${entry.id}-${keyIndex}`}
                            value={entryValue ?? 0}
                            label={entry.label}
                            name={entry.name}
                            aliases={entry.aliases}
                            notes={entry.notes}
                            colorMode={colorMode}
                            baseKeyValue={entryValue ?? 0}
                            onSelect={handleKeySelect}
                            onClickOverride={overrideClick}
                            isSelected={
                                behaviorKind || entry.displayOnly
                                    ? false
                                    : isKeySelected(entryValue)
                            }
                        />
                    )
                }

                // Keyboard-grid pages get the design's named category sections;
                // flat-grid pages stay a single ungrouped wrap.
                const sections =
                    page.style === 'keyboard-grid'
                        ? groupEntriesIntoSections(filteredKeys, (entry) =>
                              categoryForUsage(valueByEntryId.get(entry.id)),
                          )
                        : [{ title: '', entries: filteredKeys }]

                return (
                    <TabsContent
                        key={page.id}
                        value={index.toString()}
                        className="mt-4"
                    >
                        {
                            // pattern-check: skip — presentational grouped chip-section render; logic in keycodeGrid helper
                        }
                        <div
                            className="px-2 py-1"
                            style={{
                                // Tall surfaces (inspector panel) set --kc-picker-max-h
                                // so the chip list fills the column; the bottom sheet
                                // falls back to the fixed cap.
                                maxHeight: `var(--kc-picker-max-h, ${CONTAINER_MAX_HEIGHT}px)`,
                                overflowY: 'auto',
                                overflowX: 'hidden',
                            }}
                        >
                            <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                                <span className="rounded-full bg-secondary px-2 py-0.5 tabular-nums text-foreground">
                                    {filteredKeys.length}
                                </span>
                                {filteredKeys.length === 1 ? 'key' : 'keys'}
                                {searchQuery.trim()
                                    ? ' matched'
                                    : ' in this tab'}
                            </div>
                            {sections.map((section) => (
                                <div
                                    key={section.title || 'all'}
                                    className="mb-4"
                                >
                                    {section.title && (
                                        <div className="mb-2 flex items-baseline gap-2">
                                            <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">
                                                {section.title}
                                            </span>
                                            <span className="text-[10px] tabular-nums text-muted-foreground/60">
                                                {section.entries.length}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-1.5">
                                        {section.entries.map(
                                            (entry, keyIndex) =>
                                                renderChip(entry, keyIndex),
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </TabsContent>
                )
            })}
        </Tabs>
    )
}
