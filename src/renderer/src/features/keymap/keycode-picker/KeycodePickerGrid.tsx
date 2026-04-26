import { useState, useEffect, useCallback, useMemo } from 'react'
import { KeyboardKeys, keyboards } from '@/data/keys'
import KeycodeButton from './KeycodeButton.tsx'
import { Key } from 'react-aria-components'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/tabs.tsx'
import { Input } from '@/ui/input.tsx'
import {
    hidUsageFromPageAndId,
    hidUsagePageAndIdFromUsage,
} from '@/lib/behaviors/hidUsages.ts'

interface KeycodePickerGridProps {
    value?: number
    label?: string
    onValueChanged?: (value?: number) => void
    onKeySelected?: (key: number | undefined) => void
    onModifiersChanged?: (modifiers: Mods[]) => void
}

// Container dimensions - easily configurable
const CONTAINER_MAX_HEIGHT = 350 // Maximum height in pixels

// Modifier key definitions (same as HidUsagePicker)
enum Mods {
    LeftControl = 0x01,
    LeftShift = 0x02,
    LeftAlt = 0x04,
    LeftGUI = 0x08,
    RightControl = 0x10,
    RightShift = 0x20,
    RightAlt = 0x40,
    RightGUI = 0x80,
}

const all_mods = [
    Mods.LeftControl,
    Mods.LeftShift,
    Mods.LeftAlt,
    Mods.LeftGUI,
    Mods.RightControl,
    Mods.RightShift,
    Mods.RightAlt,
    Mods.RightGUI,
]

function mods_to_flags(mods: Mods[]): number {
    return mods.reduce((a: number, v: Mods): number => a + v, 0)
}

export function KeycodePickerGrid({
    value,
    onValueChanged,
}: KeycodePickerGridProps): JSX.Element {
    const [activeTab, setActiveTab] = useState('0')
    const [selectedKey, setSelectedKey] = useState<number | undefined>(
        undefined,
    )
    const [searchQuery, setSearchQuery] = useState('')

    const mods = useMemo((): string[] => {
        const flags = value ? value >> 24 : 0

        return all_mods
            .filter((m: Mods): boolean => (m & flags) !== 0)
            .map((m: Mods): string => m.toLocaleString())
    }, [value])

    const handleKeySelect = useCallback(
        (e: Key | null) => {
            let value = typeof e == 'number' ? e : undefined
            if (value !== undefined) {
                const mod_flags = mods_to_flags(mods.map((m) => parseInt(m)))
                value = value | (mod_flags << 24)
            }
            setSelectedKey(value)
            onValueChanged?.(value)
        },
        [onValueChanged, mods],
    )

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedKey(value)
    }, [value])

    // Set the active tab based on the selected key's HID usage page
    useEffect(() => {
        if (value !== undefined && value !== 0) {
            // Extract HID usage page and ID from value
            // HID usage format: (page << 16) | id
            // Modifiers are stored in bits 24-31, so we mask them out first
            const maskedValue = value & 0x00ffffff // Mask out modifier flags in upper 8 bits
            const [page, id] = hidUsagePageAndIdFromUsage(maskedValue)

            // Find which keyboard tab contains this key
            for (let i = 0; i < keyboards.length; i++) {
                const keyboard = keyboards[i]
                // Check if this keyboard's page matches
                if (keyboard.Id === page) {
                    // Verify the key ID exists in this keyboard
                    const key = keyboard.UsageIds.find((k) => {
                        const kId =
                            typeof k.Id === 'string' ? parseInt(k.Id) : k.Id
                        return kId === id
                    })
                    if (key) {
                        // Found the matching keyboard tab
                        // eslint-disable-next-line react-hooks/set-state-in-effect
                        setActiveTab(i.toString())
                        return
                    }
                }
            }

            // Fallback: if page doesn't match, try to find by key ID only
            // This handles cases where the value might be just the key ID (1-231)
            // or where the page format is different
            if (id >= 1 && id <= 231) {
                for (let i = 0; i < keyboards.length; i++) {
                    const keyboard = keyboards[i]
                    const key = keyboard.UsageIds.find((k) => {
                        const kId =
                            typeof k.Id === 'string' ? parseInt(k.Id) : k.Id
                        return kId === id
                    })
                    if (key) {
                        setActiveTab(i.toString())
                        return
                    }
                }
            }
        }
    }, [value])

    function isKeySelected(keyId: number): boolean {
        return selectedKey === keyId
    }

    // Helper function to filter keys by search query
    const filterKeysBySearch = useCallback(
        (keys: (typeof keyboards)[0]['UsageIds'], query: string) => {
            if (!query.trim()) {
                return keys
            }
            const lowerQuery = query.toLowerCase()
            return keys.filter((key) => {
                const label = key.Label || ''
                // Remove HTML tags for search comparison
                const textContent = label.replace(/<[^>]*>/g, '').toLowerCase()
                return textContent.includes(lowerQuery)
            })
        },
        [],
    )

    // Check which keyboards have matching keycodes for the search query
    const keyboardsWithMatches = useMemo(() => {
        return keyboards.map((keyboard, index) => {
            const filteredKeys = filterKeysBySearch(
                keyboard.UsageIds,
                searchQuery,
            )
            return {
                index,
                hasMatches: filteredKeys.length > 0,
            }
        })
    }, [searchQuery, filterKeysBySearch])

    // Switch to first enabled tab if current tab becomes disabled
    useEffect(() => {
        if (searchQuery.trim()) {
            const currentTabIndex = parseInt(activeTab)
            const currentKeyboard = keyboardsWithMatches[currentTabIndex]

            // If current tab has no matches, switch to first tab with matches
            if (currentKeyboard && !currentKeyboard.hasMatches) {
                const firstEnabledTab = keyboardsWithMatches.find(
                    (k) => k.hasMatches,
                )
                if (firstEnabledTab) {
                    // eslint-disable-next-line react-hooks/set-state-in-effect
                    setActiveTab(firstEnabledTab.index.toString())
                }
            }
        }
    }, [searchQuery, activeTab, keyboardsWithMatches])

    function keysList(
        keyboard: KeyboardKeys,
        key: { Id: number; Label?: string; w?: number; h?: number },
        keyIndex: number,
    ): JSX.Element {
        const keyId = hidUsageFromPageAndId(keyboard.Id, key.Id as number)
        const keyWidth = 'w' in key && key.w ? key.w / 2 : 50
        const keyHeight = 'h' in key && key.h ? key.h / 2 : 50

        return (
            <div
                key={key.Id + '-' + keyIndex}
                style={{
                    position: 'relative',
                    width: `${keyWidth}px`,
                    height: `${keyHeight}px`,
                    flexShrink: 0,
                }}
            >
                <KeycodeButton
                    value={keyId}
                    label={key.Label || ''}
                    width={keyWidth}
                    height={keyHeight}
                    x={0}
                    y={0}
                    baseKeyValue={key.Id}
                    onSelect={handleKeySelect}
                    isSelected={isKeySelected(keyId)}
                />
            </div>
        )
    }

    return (
        <>
            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
            >
                <div className="flex items-center gap-4 mb-4">
                    <TabsList className="flex-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {keyboards.map((keyboard, index) => {
                            const keyboardMatch = keyboardsWithMatches[index]
                            const isDisabled =
                                searchQuery.trim() !== '' &&
                                !keyboardMatch?.hasMatches

                            return (
                                <TabsTrigger
                                    key={keyboard.Name}
                                    value={index.toString()}
                                    disabled={isDisabled}
                                >
                                    {keyboard.Name}
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

                {keyboards.map((keyboard, index) => {
                    // Filter keys by search query first
                    const filteredKeys = filterKeysBySearch(
                        keyboard.UsageIds,
                        searchQuery,
                    )

                    // Separate keys with positions from keys without positions
                    const keysWithPositions = filteredKeys.filter(
                        (key) =>
                            key.x !== undefined &&
                            key.y !== undefined &&
                            key.x !== null &&
                            key.y !== null,
                    )
                    const keysWithoutPositions = filteredKeys.filter(
                        (key) =>
                            key.x === undefined ||
                            key.y === undefined ||
                            key.x === null ||
                            key.y === null,
                    )

                    // Calculate the maximum bottom position needed for keys with positions
                    const keySize = 50
                    let maxBottomPosition = 0
                    keysWithPositions.forEach((key) => {
                        const keyHeight = 'h' in key && key.h ? key.h / 2 : 50
                        const bottomPosition =
                            (key.y! / 100) * keySize + keyHeight
                        if (bottomPosition > maxBottomPosition) {
                            maxBottomPosition = bottomPosition
                        }
                    })

                    // Calculate approximate height needed for keys without positions (wrapping)
                    // Estimate based on average key width and container width
                    // Keys wrap, so we estimate rows needed
                    let keysWithoutPosHeight = 0
                    if (keysWithoutPositions.length > 0) {
                        const avgKeyWidth = 60 // average key width in pixels
                        const containerWidth = 800 // approximate container width
                        const keysPerRow = Math.floor(
                            containerWidth / avgKeyWidth,
                        )
                        const numRows = Math.ceil(
                            keysWithoutPositions.length / keysPerRow,
                        )
                        keysWithoutPosHeight = numRows * 60 // 60px per row (key height + gap)
                    }

                    // Set container height to accommodate all content, with padding
                    // When both positioned and unpositioned keys exist, stack them vertically
                    const totalContentHeight =
                        keysWithPositions.length > 0 &&
                        keysWithoutPositions.length > 0
                            ? maxBottomPosition + 10 + keysWithoutPosHeight + 48
                            : Math.max(
                                  maxBottomPosition + 48,
                                  keysWithoutPosHeight + 48,
                              )
                    const calculatedHeight = Math.max(totalContentHeight, 350)

                    return (
                        <TabsContent
                            key={keyboard.Name}
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
                                {/* Render keys with positions using absolute positioning */}
                                {keysWithPositions.map((key, keyIndex) => {
                                    const keyId = hidUsageFromPageAndId(
                                        keyboard.Id,
                                        key.Id as number,
                                    )
                                    const keyWidth =
                                        'w' in key && key.w ? key.w / 2 : 50
                                    const keyHeight =
                                        'h' in key && key.h ? key.h / 2 : 50

                                    return (
                                        <KeycodeButton
                                            key={key.Id + '-' + keyIndex}
                                            value={keyId}
                                            label={key.Label || ''}
                                            width={keyWidth}
                                            height={keyHeight}
                                            x={key.x! / 100}
                                            y={key.y! / 100}
                                            baseKeyValue={key.Id}
                                            onSelect={handleKeySelect}
                                            isSelected={isKeySelected(keyId)}
                                        />
                                    )
                                })}

                                {/* Render keys without positions in a horizontal flow with wrapping */}
                                {keysWithoutPositions.length > 0 && (
                                    <div
                                        style={{
                                            position:
                                                keysWithPositions.length > 0
                                                    ? 'absolute'
                                                    : 'relative',
                                            top:
                                                keysWithPositions.length > 0
                                                    ? `${maxBottomPosition + 10}px`
                                                    : '0px',
                                            left:
                                                keysWithPositions.length > 0
                                                    ? '0px'
                                                    : undefined,
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '4px',
                                            width: '100%',
                                            maxWidth: '100%',
                                        }}
                                    >
                                        {keysWithoutPositions.map(
                                            (key, keyIndex) => {
                                                return keysList(
                                                    keyboard,
                                                    key,
                                                    keyIndex,
                                                )
                                            },
                                        )}
                                    </div>
                                )}
                                {/* Spacer to ensure container scroll height includes all absolutely positioned content */}
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
        </>
    )
}
