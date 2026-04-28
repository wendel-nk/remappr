import { useState, useEffect, useCallback } from 'react'
import { keyboards } from '@/data/keys'
import KeycodeButton from './KeycodeButton.tsx'
import { Key } from 'react-aria-components'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/tabs'
import { Input } from '@/ui/input'
import {
    hidUsageFromPageAndId,
    hidUsagePageAndIdFromUsage,
} from '@/lib/behaviors/hidUsages'
import {
    maskMods,
    filterKeysBySearch,
    splitKeysByPosition,
    calculateContainerHeight,
    maxBottomForPositioned,
} from '@/lib/keymap/keycodeGrid'
import { useKeycodeFilter } from '@/hooks/use-keycode-filter'

// Pattern check: no GoF pattern (-) — rejected — added optional prop for multi-highlight, no abstraction warranted.
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
        keyboardsWithMatches,
    } = useKeycodeFilter()

    const [modFlags, setModFlags] = useState<number>(0)
    const [baseKey, setBaseKey] = useState<number | undefined>(undefined)

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
        const maskedValue = value & 0x00ffffff
        const [page, id] = hidUsagePageAndIdFromUsage(maskedValue)

        for (let i = 0; i < keyboards.length; i++) {
            const keyboard = keyboards[i]
            if (keyboard.Id === page) {
                const key = keyboard.UsageIds.find((k) => {
                    const kId = typeof k.Id === 'string' ? parseInt(k.Id) : k.Id
                    return kId === id
                })
                if (key) {
                    setActiveTab(i.toString())
                    return
                }
            }
        }

        if (id >= 1 && id <= 231) {
            for (let i = 0; i < keyboards.length; i++) {
                const keyboard = keyboards[i]
                const key = keyboard.UsageIds.find((k) => {
                    const kId = typeof k.Id === 'string' ? parseInt(k.Id) : k.Id
                    return kId === id
                })
                if (key) {
                    setActiveTab(i.toString())
                    return
                }
            }
        }
    }, [value, setActiveTab])

    function isKeySelected(keyId: number): boolean {
        const [page, id] = hidUsagePageAndIdFromUsage(keyId)
        if (isModifierKey(page, id)) {
            return (modFlags & idToModBit(id)) !== 0
        }
        if (baseKey !== undefined && baseKey === keyId) {
            return true
        }
        if (highlightedKeys?.some((k) => maskMods(k) === keyId)) {
            return true
        }
        return false
    }

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
                const filteredKeys = filterKeysBySearch(
                    keyboard.UsageIds,
                    searchQuery,
                )
                const { withPositions, withoutPositions } =
                    splitKeysByPosition(filteredKeys)
                const calculatedHeight = calculateContainerHeight(
                    withPositions,
                    withoutPositions,
                )
                const maxBottomPosition = maxBottomForPositioned(withPositions)

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
                            {withPositions.map((key, keyIndex) => {
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
                                    {withoutPositions.map((key, keyIndex) => {
                                        const keyId = hidUsageFromPageAndId(
                                            keyboard.Id,
                                            key.Id as number,
                                        )
                                        const keyWidth =
                                            'w' in key && key.w ? key.w / 2 : 50
                                        const keyHeight =
                                            'h' in key && key.h ? key.h / 2 : 50
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
                                                    isSelected={isKeySelected(
                                                        keyId,
                                                    )}
                                                />
                                            </div>
                                        )
                                    })}
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
