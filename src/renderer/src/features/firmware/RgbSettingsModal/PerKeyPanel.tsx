// pattern-check: skip — per-key HSV grid; memoized swatch list
import {memo, useCallback, useEffect, useMemo, useState} from 'react'

import type {HsvColor, RgbApi} from '@firmware/service'
import {saveWithToast} from '@/lib/saveWithToast'
import {Button} from '@/ui/button'
import {Input} from '@/ui/input'

import {hexToHsv, hsvToCss, hsvToHex} from './hsv'

const PER_KEY_BATCH_MAX = 9

interface Props {
    rgb: RgbApi
    ledCount: number
}

interface SwatchProps {
    idx: number
    color: HsvColor
    selected: boolean
    onSelect: ( idx: number ) => void
}

const Swatch = memo( function Swatch ( {
    idx,
    color,
    selected,
    onSelect,
}: SwatchProps ): JSX.Element {
    return (
        <button
            type="button"
            title={`LED ${idx} — H${color.h} S${color.s} V${color.v}`}
            onClick={(): void => onSelect( idx )}
            className={`h-8 w-8 rounded border ${
                selected ? 'ring-2 ring-primary' : 'border-border'
            }`}
            style={{backgroundColor: hsvToCss( color )}}
        />
    )
} )

export function PerKeyPanel ( {rgb, ledCount}: Props ): JSX.Element {
    const [colors, setColors] = useState<HsvColor[]>( [] )
    const [selected, setSelected] = useState<number | null>( null )
    const [loading, setLoading] = useState( false )
    const [perKeyType, setPerKeyType] = useState<number | null>( null )

    const reload = useCallback( async () => {
        if ( !rgb.getPerKeyColors ) return
        setLoading( true )
        const result = await saveWithToast(
            async () => {
                const acc: HsvColor[] = []
                for ( let s = 0; s < ledCount; s += PER_KEY_BATCH_MAX ) {
                    const n = Math.min( PER_KEY_BATCH_MAX, ledCount - s )
                    const batch = await rgb.getPerKeyColors!( s, n )
                    acc.push( ...batch )
                }
                let pkType: number | null = null
                if ( rgb.getPerKeyType ) pkType = await rgb.getPerKeyType()
                return {acc, pkType}
            },
            null,
            'Read per-key failed',
        )
        if ( result ) {
            setColors( result.acc )
            if ( result.pkType !== null ) setPerKeyType( result.pkType )
        }
        setLoading( false )
    }, [rgb, ledCount] )

    useEffect( () => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if ( ledCount > 0 && rgb.getPerKeyColors ) void reload()
    }, [reload, ledCount, rgb.getPerKeyColors] )

    const onSelect = useCallback( ( idx: number ) => setSelected( idx ), [] )

    const grid = useMemo(
        () =>
            colors.map( ( c, idx ) => (
                <Swatch
                    key={idx}
                    idx={idx}
                    color={c}
                    selected={selected === idx}
                    onSelect={onSelect}
                />
            ) ),
        [colors, selected, onSelect],
    )

    if ( !rgb.getPerKeyColors || !rgb.setPerKeyColors ) {
        return (
            <div className="text-xs text-muted-foreground">
                Per-key RGB not exposed by this firmware build.
            </div>
        )
    }

    const updateLocal = ( idx: number, patch: Partial<HsvColor> ): void => {
        setColors( ( prev ) => {
            const next = prev.slice()
            next[idx] = {...next[idx], ...patch}
            return next
        } )
    }

    const writeOne = async ( idx: number ): Promise<void> => {
        if ( !rgb.setPerKeyColors ) return
        await saveWithToast(
            () => rgb.setPerKeyColors!( idx, [colors[idx]] ),
            `LED ${idx} updated`,
            'Write failed',
        )
    }

    const writeAll = async (): Promise<void> => {
        if ( !rgb.setPerKeyColors ) return
        setLoading( true )
        await saveWithToast(
            async () => {
                for ( let s = 0; s < colors.length; s += PER_KEY_BATCH_MAX ) {
                    const slice = colors.slice( s, s + PER_KEY_BATCH_MAX )
                    await rgb.setPerKeyColors!( s, slice )
                }
            },
            'All LEDs written',
            'Write all failed',
        )
        setLoading( false )
    }

    const fillAll = ( color: HsvColor ): void => {
        setColors( ( prev ) => prev.map( () => ({...color}) ) )
    }

    const cur = selected !== null ? colors[selected] : null

    return (
        <div className="flex flex-col gap-3">
            {perKeyType !== null && (
                <div className="text-xs">
                    <span className="font-semibold">Per-key type:</span>{' '}
                    {perKeyType}
                    {rgb.setPerKeyType && (
                        <Input
                            type="number"
                            min={0}
                            max={255}
                            defaultValue={perKeyType}
                            onBlur={async ( e ): Promise<void> => {
                                if ( !rgb.setPerKeyType ) return
                                const v = Number( e.currentTarget.value )
                                if ( !Number.isFinite( v ) ) return
                                const r = await saveWithToast(
                                    () => rgb.setPerKeyType!( v & 0xff ),
                                    null,
                                    'Set type failed',
                                )
                                if ( r !== undefined ) setPerKeyType( v & 0xff )
                            }}
                            className="mt-1 w-24"
                        />
                    )}
                </div>
            )}

            <div className="grid grid-cols-12 gap-1">{grid}</div>

            {cur !== null && selected !== null && (
                <div className="rounded border p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs">
                        <span className="font-semibold">LED {selected}</span>
                        <span
                            className="inline-block h-5 w-5 rounded border"
                            style={{backgroundColor: hsvToCss( cur )}}
                        />
                        <input
                            type="color"
                            value={hsvToHex( cur )}
                            onChange={( e ): void => {
                                const next = hexToHsv( e.currentTarget.value )
                                if ( next ) updateLocal( selected, next )
                            }}
                            aria-label="Pick color"
                            className="ml-auto h-6 w-10 cursor-pointer rounded border bg-transparent p-0"
                        />
                    </div>
                    {(['h', 's', 'v'] as const).map( ( ch ) => (
                        <label
                            key={ch}
                            className="flex items-center gap-2 text-xs"
                        >
                            <span className="w-4 uppercase">{ch}</span>
                            <input
                                type="range"
                                min={0}
                                max={255}
                                value={cur[ch]}
                                onChange={( e ): void =>
                                    updateLocal( selected, {
                                        [ch]: Number( e.currentTarget.value ),
                                    } )
                                }
                                className="flex-1"
                            />
                            <span className="w-10 text-right tabular-nums">
                                {cur[ch]}
                            </span>
                        </label>
                    ) )}
                    <div className="mt-2 flex gap-2">
                        <Button
                            size="sm"
                            onClick={(): void => {
                                void writeOne( selected )
                            }}
                        >
                            Write LED
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={(): void => fillAll( cur )}
                        >
                            Fill all
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={(): void => {
                        void reload()
                    }}
                    disabled={loading}
                >
                    Reload
                </Button>
                <Button
                    size="sm"
                    onClick={(): void => {
                        void writeAll()
                    }}
                    disabled={loading || colors.length === 0}
                >
                    Write all
                </Button>
            </div>
        </div>
    )
}
