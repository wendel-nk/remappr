// pattern-check: skip — Keychron RGB settings modal; reads/writes through service.rgb facade
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { KeyboardService } from '@firmware'
import type { HsvColor, RgbApi } from '@firmware/service'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/tabs'

interface Props {
    service: KeyboardService | null
    opened: boolean
    onClose: () => void
}

const PER_KEY_BATCH_MAX = 9

function bytesToHex(buf: Uint8Array): string {
    return Array.from(buf)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ')
}

function hexToBytes(text: string): Uint8Array | null {
    const tokens = text
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
    const out = new Uint8Array(tokens.length)
    for (let i = 0; i < tokens.length; i++) {
        const v = parseInt(tokens[i], 16)
        if (!Number.isFinite(v) || v < 0 || v > 0xff) return null
        out[i] = v
    }
    return out
}

// HSV (each 0..255 per Keychron wire format) → CSS rgb() string for swatch.
function hsvToCss({ h, s, v }: HsvColor): string {
    const hh = (h / 255) * 6
    const ss = s / 255
    const vv = v / 255
    const i = Math.floor(hh) % 6
    const f = hh - Math.floor(hh)
    const p = vv * (1 - ss)
    const q = vv * (1 - f * ss)
    const t = vv * (1 - (1 - f) * ss)
    let r = 0,
        g = 0,
        b = 0
    if (i === 0) [r, g, b] = [vv, t, p]
    else if (i === 1) [r, g, b] = [q, vv, p]
    else if (i === 2) [r, g, b] = [p, vv, t]
    else if (i === 3) [r, g, b] = [p, q, vv]
    else if (i === 4) [r, g, b] = [t, p, vv]
    else [r, g, b] = [vv, p, q]
    return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`
}

interface PerKeyPanelProps {
    rgb: RgbApi
    ledCount: number
}

function PerKeyPanel({ rgb, ledCount }: PerKeyPanelProps): JSX.Element {
    const [colors, setColors] = useState<HsvColor[]>([])
    const [selected, setSelected] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)
    const [perKeyType, setPerKeyType] = useState<number | null>(null)

    const reload = useCallback(async () => {
        if (!rgb.getPerKeyColors) return
        setLoading(true)
        try {
            const acc: HsvColor[] = []
            for (let s = 0; s < ledCount; s += PER_KEY_BATCH_MAX) {
                const n = Math.min(PER_KEY_BATCH_MAX, ledCount - s)
                const batch = await rgb.getPerKeyColors(s, n)
                acc.push(...batch)
            }
            setColors(acc)
            if (rgb.getPerKeyType) {
                setPerKeyType(await rgb.getPerKeyType())
            }
        } catch (e) {
            toast.error(
                `Read per-key failed: ${
                    e instanceof Error ? e.message : String(e)
                }`,
            )
        } finally {
            setLoading(false)
        }
    }, [rgb, ledCount])

    useEffect(() => {
        if (ledCount > 0 && rgb.getPerKeyColors) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            void reload()
        }
    }, [reload, ledCount, rgb.getPerKeyColors])

    if (!rgb.getPerKeyColors || !rgb.setPerKeyColors) {
        return (
            <div className="text-xs text-muted-foreground">
                Per-key RGB not exposed by this firmware build.
            </div>
        )
    }

    const updateLocal = (idx: number, patch: Partial<HsvColor>): void => {
        setColors((prev) => {
            const next = prev.slice()
            next[idx] = { ...next[idx], ...patch }
            return next
        })
    }

    const writeOne = async (idx: number): Promise<void> => {
        if (!rgb.setPerKeyColors) return
        try {
            await rgb.setPerKeyColors(idx, [colors[idx]])
            toast.success(`LED ${idx} updated`)
        } catch (e) {
            toast.error(
                `Write failed: ${e instanceof Error ? e.message : String(e)}`,
            )
        }
    }

    const writeAll = async (): Promise<void> => {
        if (!rgb.setPerKeyColors) return
        setLoading(true)
        try {
            for (let s = 0; s < colors.length; s += PER_KEY_BATCH_MAX) {
                const slice = colors.slice(s, s + PER_KEY_BATCH_MAX)
                await rgb.setPerKeyColors(s, slice)
            }
            toast.success('All LEDs written')
        } catch (e) {
            toast.error(
                `Write all failed: ${
                    e instanceof Error ? e.message : String(e)
                }`,
            )
        } finally {
            setLoading(false)
        }
    }

    const fillAll = (color: HsvColor): void => {
        setColors((prev) => prev.map(() => ({ ...color })))
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
                            onBlur={async (e): Promise<void> => {
                                if (!rgb.setPerKeyType) return
                                const v = Number(e.currentTarget.value)
                                if (!Number.isFinite(v)) return
                                try {
                                    await rgb.setPerKeyType(v & 0xff)
                                    setPerKeyType(v & 0xff)
                                } catch (err) {
                                    toast.error(
                                        `Set type failed: ${
                                            err instanceof Error
                                                ? err.message
                                                : String(err)
                                        }`,
                                    )
                                }
                            }}
                            className="mt-1 w-24"
                        />
                    )}
                </div>
            )}

            <div className="grid grid-cols-12 gap-1">
                {colors.map((c, idx) => (
                    <button
                        key={idx}
                        type="button"
                        title={`LED ${idx} — H${c.h} S${c.s} V${c.v}`}
                        onClick={(): void => setSelected(idx)}
                        className={`h-8 w-8 rounded border ${
                            selected === idx
                                ? 'ring-2 ring-primary'
                                : 'border-border'
                        }`}
                        style={{ backgroundColor: hsvToCss(c) }}
                    />
                ))}
            </div>

            {cur !== null && selected !== null && (
                <div className="rounded border p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs">
                        <span className="font-semibold">LED {selected}</span>
                        <span
                            className="inline-block h-5 w-5 rounded border"
                            style={{ backgroundColor: hsvToCss(cur) }}
                        />
                    </div>
                    {(['h', 's', 'v'] as const).map((ch) => (
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
                                onChange={(e): void =>
                                    updateLocal(selected, {
                                        [ch]: Number(e.currentTarget.value),
                                    })
                                }
                                className="flex-1"
                            />
                            <span className="w-10 text-right tabular-nums">
                                {cur[ch]}
                            </span>
                        </label>
                    ))}
                    <div className="mt-2 flex gap-2">
                        <Button
                            size="sm"
                            onClick={(): void => {
                                void writeOne(selected)
                            }}
                        >
                            Write LED
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={(): void => fillAll(cur)}
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

interface BytesEditorProps {
    label: string
    bytes: Uint8Array
    onChange: (next: Uint8Array) => void
    onWrite: () => void | Promise<void>
    onReload: () => void | Promise<void>
}

function BytesEditor({
    label,
    bytes,
    onChange,
    onWrite,
    onReload,
}: BytesEditorProps): JSX.Element {
    const hexText = useMemo(() => bytesToHex(bytes), [bytes])
    const [draft, setDraft] = useState(hexText)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraft(hexText)
        setError(null)
    }, [hexText])

    const apply = (): void => {
        const parsed = hexToBytes(draft)
        if (!parsed) {
            setError('Invalid hex bytes (use space-separated 00..ff)')
            return
        }
        setError(null)
        onChange(parsed)
    }

    return (
        <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{label}</h3>
            <div className="text-xs text-muted-foreground">
                Payload shape varies per board. Edit raw bytes, apply, then
                write.
            </div>
            <textarea
                value={draft}
                onChange={(e): void => setDraft(e.currentTarget.value)}
                onBlur={apply}
                className="min-h-24 w-full rounded border bg-transparent p-2 font-mono text-xs"
                spellCheck={false}
            />
            {error && <div className="text-xs text-destructive">{error}</div>}
            <div className="flex gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={(): void => {
                        void onReload()
                    }}
                >
                    Reload
                </Button>
                <Button
                    size="sm"
                    onClick={(): void => {
                        apply()
                        void onWrite()
                    }}
                >
                    Write
                </Button>
            </div>
        </div>
    )
}

interface MixedPanelProps {
    rgb: RgbApi
}

function MixedPanel({ rgb }: MixedPanelProps): JSX.Element {
    const [regions, setRegions] = useState<Uint8Array>(new Uint8Array())
    const [effect, setEffect] = useState<Uint8Array>(new Uint8Array())

    const reloadRegions = useCallback(async () => {
        if (!rgb.getMixedRegions) return
        try {
            setRegions(await rgb.getMixedRegions())
        } catch (e) {
            toast.error(
                `Regions read failed: ${
                    e instanceof Error ? e.message : String(e)
                }`,
            )
        }
    }, [rgb])

    const reloadEffect = useCallback(async () => {
        if (!rgb.getMixedEffect) return
        try {
            setEffect(await rgb.getMixedEffect())
        } catch (e) {
            toast.error(
                `Effect read failed: ${
                    e instanceof Error ? e.message : String(e)
                }`,
            )
        }
    }, [rgb])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void reloadRegions()
        void reloadEffect()
    }, [reloadRegions, reloadEffect])

    if (!rgb.getMixedRegions || !rgb.setMixedRegions) {
        return (
            <div className="text-xs text-muted-foreground">
                Mixed-effect not exposed by this firmware build.
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <BytesEditor
                label="Regions"
                bytes={regions}
                onChange={setRegions}
                onReload={reloadRegions}
                onWrite={async (): Promise<void> => {
                    if (!rgb.setMixedRegions) return
                    try {
                        await rgb.setMixedRegions(regions)
                        toast.success('Regions written')
                    } catch (e) {
                        toast.error(
                            `Regions write failed: ${
                                e instanceof Error ? e.message : String(e)
                            }`,
                        )
                    }
                }}
            />
            {rgb.getMixedEffect && rgb.setMixedEffect && (
                <BytesEditor
                    label="Effect"
                    bytes={effect}
                    onChange={setEffect}
                    onReload={reloadEffect}
                    onWrite={async (): Promise<void> => {
                        if (!rgb.setMixedEffect) return
                        try {
                            await rgb.setMixedEffect(effect)
                            toast.success('Effect written')
                        } catch (e) {
                            toast.error(
                                `Effect write failed: ${
                                    e instanceof Error ? e.message : String(e)
                                }`,
                            )
                        }
                    }}
                />
            )}
        </div>
    )
}

export function RgbSettingsModal({
    service,
    opened,
    onClose,
}: Props): JSX.Element {
    const rgb = service?.rgb

    const [ledCount, setLedCount] = useState<number | null>(null)
    const [indicatorsRaw, setIndicatorsRaw] = useState<Uint8Array>(
        new Uint8Array(),
    )
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!opened || !rgb) return
        let cancelled = false
        ;(async () => {
            setLoading(true)
            try {
                const count = await rgb.getLedCount()
                if (!cancelled) setLedCount(count)
                const ind = await rgb.getIndicators()
                if (!cancelled) setIndicatorsRaw(ind.raw)
            } catch (e) {
                toast.error(
                    `Read RGB failed: ${
                        e instanceof Error ? e.message : String(e)
                    }`,
                )
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return (): void => {
            cancelled = true
        }
    }, [opened, rgb])

    if (!rgb) return <></>

    const save = async (): Promise<void> => {
        try {
            await rgb.save()
            toast.success('RGB settings saved to keyboard')
        } catch (e) {
            toast.error(
                `Save failed: ${e instanceof Error ? e.message : String(e)}`,
            )
        }
    }

    const writeIndicators = async (): Promise<void> => {
        try {
            await rgb.setIndicators({ raw: indicatorsRaw })
            toast.success('Indicators written')
        } catch (e) {
            toast.error(
                `Indicators write failed: ${
                    e instanceof Error ? e.message : String(e)
                }`,
            )
        }
    }

    const reloadIndicators = async (): Promise<void> => {
        try {
            const ind = await rgb.getIndicators()
            setIndicatorsRaw(ind.raw)
        } catch (e) {
            toast.error(
                `Indicators read failed: ${
                    e instanceof Error ? e.message : String(e)
                }`,
            )
        }
    }

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="RGB Settings"
            customModalBoxClass="sm:max-w-2xl"
            showFooter={false}
        >
            <div className="flex flex-col gap-3 p-1 text-sm">
                <div className="flex items-center gap-3">
                    <span className="text-xs">
                        <span className="font-semibold">LED count:</span>{' '}
                        {ledCount === null ? '…' : ledCount}
                    </span>
                    <Button
                        size="sm"
                        onClick={save}
                        disabled={loading}
                        className="ml-auto"
                    >
                        Save to keyboard
                    </Button>
                </div>

                <Tabs defaultValue="indicators">
                    <TabsList>
                        <TabsTrigger value="indicators">Indicators</TabsTrigger>
                        <TabsTrigger value="perkey">Per-key</TabsTrigger>
                        <TabsTrigger value="mixed">Mixed</TabsTrigger>
                    </TabsList>
                    <TabsContent value="indicators">
                        <BytesEditor
                            label="Indicators"
                            bytes={indicatorsRaw}
                            onChange={setIndicatorsRaw}
                            onReload={reloadIndicators}
                            onWrite={writeIndicators}
                        />
                    </TabsContent>
                    <TabsContent value="perkey">
                        <PerKeyPanel rgb={rgb} ledCount={ledCount ?? 0} />
                    </TabsContent>
                    <TabsContent value="mixed">
                        <MixedPanel rgb={rgb} />
                    </TabsContent>
                </Tabs>
            </div>
        </Modal>
    )
}
