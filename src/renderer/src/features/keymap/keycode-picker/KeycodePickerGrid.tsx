import { useState, useEffect, useCallback, useMemo } from 'react'
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
    Mods,
    all_mods,
    modsToFlags,
    filterKeysBySearch,
    splitKeysByPosition,
    calculateContainerHeight,
    maxBottomForPositioned,
} from '@/lib/keymap/keycodeGrid'
import { useKeycodeFilter } from '@/hooks/use-keycode-filter'

interface KeycodePickerGridProps {
    value?: number
    label?: string
    onValueChanged?: (value?: number) => void
    onKeySelected?: (key: number | undefined) => void
    onModifiersChanged?: (modifiers: Mods[]) => void
}

const CONTAINER_MAX_HEIGHT = 350

export function KeycodePickerGrid({
    value,
    onValueChanged,
}: KeycodePickerGridProps): JSX.Element {
    const {
        searchQuery,
        setSearchQuery,
        activeTab,
        setActiveTab,
        keyboardsWithMatches,
    } = useKeycodeFilter()

    const [selectedKey, setSelectedKey] = useState<number | undefined>(
        undefined,
    )

    const mods = useMemo((): string[] => {
        const flags = value ? value >> 24 : 0
        return all_mods
            .filter((m: Mods): boolean => (m & flags) !== 0)
            .map((m: Mods): string => m.toLocaleString())
    }, [value])

    const handleKeySelect = useCallback(
        (e: Key | null) => {
            let v = typeof e == 'number' ? e : undefined
            if (v !== undefined) {
                const mod_flags = modsToFlags(mods.map((m) => parseInt(m)))
                v = v | (mod_flags << 24)
            }
            setSelectedKey(v)
            onValueChanged?.(v)
        },
        [onValueChanged, mods],
    )

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedKey(value)
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
        return selectedKey === keyId
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
