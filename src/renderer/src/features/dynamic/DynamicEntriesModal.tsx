// pattern-check: skip — per-tab form for four Vial wire-shape entry kinds, no abstraction warranted
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import type {
    AltRepeatKeyEntry,
    ComboEntry,
    KeyOverrideEntry,
    KeyboardService,
    TapDanceEntry,
} from '@firmware'
import { Modal } from '@/ui/modal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'

interface Props {
    service: KeyboardService | null
    opened: boolean
    onClose: () => void
}

const hex = (v: number): string =>
    '0x' + (v & 0xffff).toString(16).padStart(4, '0')
const parseHex = (s: string): number => {
    const v = s.startsWith('0x') ? parseInt(s.slice(2), 16) : parseInt(s, 10)
    return Number.isFinite(v) ? v & 0xffff : 0
}

function NumField({
    label,
    value,
    onChange,
}: {
    label: string
    value: number
    onChange: (v: number) => void
}): JSX.Element {
    return (
        <div className="flex items-center gap-2">
            <Label className="w-28 text-xs">{label}</Label>
            <Input
                value={hex(value)}
                onChange={(e) => onChange(parseHex(e.target.value))}
                className="w-32 font-mono text-xs"
            />
        </div>
    )
}

function CheckField({
    label,
    value,
    onChange,
}: {
    label: string
    value: boolean
    onChange: (v: boolean) => void
}): JSX.Element {
    return (
        <label className="flex items-center gap-2 text-xs">
            <input
                type="checkbox"
                checked={value}
                onChange={(e) => onChange(e.target.checked)}
            />
            {label}
        </label>
    )
}

function TapDanceTab({
    service,
    count,
}: {
    service: KeyboardService
    count: number
}): JSX.Element {
    const [idx, setIdx] = useState(0)
    const [entry, setEntry] = useState<TapDanceEntry | null>(null)
    useEffect(() => {
        let cancelled = false
        service.dynamic?.getTapDance(idx).then((e) => {
            if (!cancelled) setEntry(e)
        })
        return () => {
            cancelled = true
        }
    }, [service, idx])

    const save = async (): Promise<void> => {
        if (!entry || !service.dynamic) return
        try {
            await service.dynamic.setTapDance(idx, entry)
            toast.success(`Tap-dance #${idx} saved`)
        } catch (e) {
            toast.error('Failed to save tap-dance')
            console.error(e)
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Label>Index</Label>
                <Input
                    type="number"
                    min={0}
                    max={count - 1}
                    value={idx}
                    onChange={(e) =>
                        setIdx(
                            Math.max(
                                0,
                                Math.min(
                                    count - 1,
                                    parseInt(e.target.value) || 0,
                                ),
                            ),
                        )
                    }
                    className="w-20"
                />
                <span className="text-xs text-muted-foreground">
                    of {count}
                </span>
            </div>
            {entry && (
                <>
                    <NumField
                        label="On Tap"
                        value={entry.onTap}
                        onChange={(v) => setEntry({ ...entry, onTap: v })}
                    />
                    <NumField
                        label="On Hold"
                        value={entry.onHold}
                        onChange={(v) => setEntry({ ...entry, onHold: v })}
                    />
                    <NumField
                        label="On Double"
                        value={entry.onDoubleTap}
                        onChange={(v) => setEntry({ ...entry, onDoubleTap: v })}
                    />
                    <NumField
                        label="On Tap-Hold"
                        value={entry.onTapHold}
                        onChange={(v) => setEntry({ ...entry, onTapHold: v })}
                    />
                    <NumField
                        label="Term (ms)"
                        value={entry.tappingTerm}
                        onChange={(v) => setEntry({ ...entry, tappingTerm: v })}
                    />
                    <Button onClick={save} size="sm">
                        Save
                    </Button>
                </>
            )}
        </div>
    )
}

function ComboTab({
    service,
    count,
}: {
    service: KeyboardService
    count: number
}): JSX.Element {
    const [idx, setIdx] = useState(0)
    const [entry, setEntry] = useState<ComboEntry | null>(null)
    useEffect(() => {
        let cancelled = false
        service.dynamic?.getCombo(idx).then((e) => {
            if (!cancelled) setEntry(e)
        })
        return () => {
            cancelled = true
        }
    }, [service, idx])

    const setKey = (i: number, v: number): void => {
        if (!entry) return
        const keys = [...entry.keys] as ComboEntry['keys']
        keys[i] = v
        setEntry({ ...entry, keys })
    }

    const save = async (): Promise<void> => {
        if (!entry || !service.dynamic) return
        try {
            await service.dynamic.setCombo(idx, entry)
            toast.success(`Combo #${idx} saved`)
        } catch (e) {
            toast.error('Failed to save combo')
            console.error(e)
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Label>Index</Label>
                <Input
                    type="number"
                    min={0}
                    max={count - 1}
                    value={idx}
                    onChange={(e) =>
                        setIdx(
                            Math.max(
                                0,
                                Math.min(
                                    count - 1,
                                    parseInt(e.target.value) || 0,
                                ),
                            ),
                        )
                    }
                    className="w-20"
                />
                <span className="text-xs text-muted-foreground">
                    of {count}
                </span>
            </div>
            {entry && (
                <>
                    {entry.keys.map((k, i) => (
                        <NumField
                            key={i}
                            label={`Key ${i + 1}`}
                            value={k}
                            onChange={(v) => setKey(i, v)}
                        />
                    ))}
                    <NumField
                        label="Output"
                        value={entry.output}
                        onChange={(v) => setEntry({ ...entry, output: v })}
                    />
                    <Button onClick={save} size="sm">
                        Save
                    </Button>
                </>
            )}
        </div>
    )
}

function KeyOverrideTab({
    service,
    count,
}: {
    service: KeyboardService
    count: number
}): JSX.Element {
    const [idx, setIdx] = useState(0)
    const [entry, setEntry] = useState<KeyOverrideEntry | null>(null)
    useEffect(() => {
        let cancelled = false
        service.dynamic?.getKeyOverride(idx).then((e) => {
            if (!cancelled) setEntry(e)
        })
        return () => {
            cancelled = true
        }
    }, [service, idx])

    const setOpt = (k: keyof KeyOverrideEntry['options'], v: boolean): void => {
        if (!entry) return
        setEntry({ ...entry, options: { ...entry.options, [k]: v } })
    }

    const save = async (): Promise<void> => {
        if (!entry || !service.dynamic) return
        try {
            await service.dynamic.setKeyOverride(idx, entry)
            toast.success(`Key-override #${idx} saved`)
        } catch (e) {
            toast.error('Failed to save key-override')
            console.error(e)
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Label>Index</Label>
                <Input
                    type="number"
                    min={0}
                    max={count - 1}
                    value={idx}
                    onChange={(e) =>
                        setIdx(
                            Math.max(
                                0,
                                Math.min(
                                    count - 1,
                                    parseInt(e.target.value) || 0,
                                ),
                            ),
                        )
                    }
                    className="w-20"
                />
                <span className="text-xs text-muted-foreground">
                    of {count}
                </span>
            </div>
            {entry && (
                <>
                    <NumField
                        label="Trigger"
                        value={entry.trigger}
                        onChange={(v) => setEntry({ ...entry, trigger: v })}
                    />
                    <NumField
                        label="Replacement"
                        value={entry.replacement}
                        onChange={(v) => setEntry({ ...entry, replacement: v })}
                    />
                    <NumField
                        label="Layer mask"
                        value={entry.layers}
                        onChange={(v) => setEntry({ ...entry, layers: v })}
                    />
                    <NumField
                        label="Trigger mods"
                        value={entry.triggerMods}
                        onChange={(v) =>
                            setEntry({ ...entry, triggerMods: v & 0xff })
                        }
                    />
                    <NumField
                        label="Negative mods"
                        value={entry.negativeModMask}
                        onChange={(v) =>
                            setEntry({ ...entry, negativeModMask: v & 0xff })
                        }
                    />
                    <NumField
                        label="Suppressed mods"
                        value={entry.suppressedMods}
                        onChange={(v) =>
                            setEntry({ ...entry, suppressedMods: v & 0xff })
                        }
                    />
                    <div className="grid grid-cols-2 gap-1 mt-2">
                        <CheckField
                            label="Enabled"
                            value={entry.options.enabled}
                            onChange={(v) => setOpt('enabled', v)}
                        />
                        <CheckField
                            label="Activate on trigger down"
                            value={entry.options.activationTriggerDown}
                            onChange={(v) => setOpt('activationTriggerDown', v)}
                        />
                        <CheckField
                            label="Required mod down"
                            value={entry.options.activationRequiredModDown}
                            onChange={(v) =>
                                setOpt('activationRequiredModDown', v)
                            }
                        />
                        <CheckField
                            label="Negative mod up"
                            value={entry.options.activationNegativeModUp}
                            onChange={(v) =>
                                setOpt('activationNegativeModUp', v)
                            }
                        />
                        <CheckField
                            label="One mod"
                            value={entry.options.oneMod}
                            onChange={(v) => setOpt('oneMod', v)}
                        />
                        <CheckField
                            label="No re-register"
                            value={entry.options.noReregisterTrigger}
                            onChange={(v) => setOpt('noReregisterTrigger', v)}
                        />
                        <CheckField
                            label="No unregister on other"
                            value={entry.options.noUnregisterOnOtherKeyDown}
                            onChange={(v) =>
                                setOpt('noUnregisterOnOtherKeyDown', v)
                            }
                        />
                    </div>
                    <Button onClick={save} size="sm">
                        Save
                    </Button>
                </>
            )}
        </div>
    )
}

function AltRepeatKeyTab({
    service,
}: {
    service: KeyboardService
}): JSX.Element {
    const [idx, setIdx] = useState(0)
    const [entry, setEntry] = useState<AltRepeatKeyEntry | null>(null)
    // ARK has no entry-count from the protocol; allow up to 31 (Vial soft cap).
    const max = 31
    useEffect(() => {
        let cancelled = false
        service.dynamic?.getAltRepeatKey?.(idx).then((e) => {
            if (!cancelled) setEntry(e)
        })
        return () => {
            cancelled = true
        }
    }, [service, idx])

    const setOpt = (
        k: keyof AltRepeatKeyEntry['options'],
        v: boolean,
    ): void => {
        if (!entry) return
        setEntry({ ...entry, options: { ...entry.options, [k]: v } })
    }

    const save = async (): Promise<void> => {
        if (!entry || !service.dynamic?.setAltRepeatKey) return
        try {
            await service.dynamic.setAltRepeatKey(idx, entry)
            toast.success(`Alt-repeat-key #${idx} saved`)
        } catch (e) {
            toast.error('Failed to save alt-repeat-key')
            console.error(e)
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <Label>Index</Label>
                <Input
                    type="number"
                    min={0}
                    max={max}
                    value={idx}
                    onChange={(e) =>
                        setIdx(
                            Math.max(
                                0,
                                Math.min(max, parseInt(e.target.value) || 0),
                            ),
                        )
                    }
                    className="w-20"
                />
            </div>
            {entry && (
                <>
                    <NumField
                        label="Keycode"
                        value={entry.keycode}
                        onChange={(v) => setEntry({ ...entry, keycode: v })}
                    />
                    <NumField
                        label="Alt keycode"
                        value={entry.altKeycode}
                        onChange={(v) => setEntry({ ...entry, altKeycode: v })}
                    />
                    <NumField
                        label="Allowed mods"
                        value={entry.allowedMods}
                        onChange={(v) =>
                            setEntry({ ...entry, allowedMods: v & 0xff })
                        }
                    />
                    <div className="grid grid-cols-2 gap-1 mt-2">
                        <CheckField
                            label="Enabled"
                            value={entry.options.enabled}
                            onChange={(v) => setOpt('enabled', v)}
                        />
                        <CheckField
                            label="Default to alt"
                            value={entry.options.defaultToThisAltKey}
                            onChange={(v) => setOpt('defaultToThisAltKey', v)}
                        />
                        <CheckField
                            label="Bidirectional"
                            value={entry.options.bidirectional}
                            onChange={(v) => setOpt('bidirectional', v)}
                        />
                        <CheckField
                            label="Ignore handedness"
                            value={entry.options.ignoreModHandedness}
                            onChange={(v) => setOpt('ignoreModHandedness', v)}
                        />
                    </div>
                    <Button onClick={save} size="sm">
                        Save
                    </Button>
                </>
            )}
        </div>
    )
}

export function DynamicEntriesModal({
    service,
    opened,
    onClose,
}: Props): JSX.Element | null {
    if (!service) return null
    const counts = service.dynamic?.getCounts()
    const hasARK = !!service.dynamic?.getAltRepeatKey
    if (!counts) return null

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Dynamic Entries"
            xButton={true}
            isDismissable={true}
            showFooter={false}
        >
            <Tabs defaultValue="td">
                <TabsList>
                    {counts.tapDance > 0 && (
                        <TabsTrigger value="td">Tap Dance</TabsTrigger>
                    )}
                    {counts.combo > 0 && (
                        <TabsTrigger value="combo">Combo</TabsTrigger>
                    )}
                    {counts.keyOverride > 0 && (
                        <TabsTrigger value="ko">Key Override</TabsTrigger>
                    )}
                    {hasARK && (
                        <TabsTrigger value="ark">Alt Repeat Key</TabsTrigger>
                    )}
                </TabsList>
                {counts.tapDance > 0 && (
                    <TabsContent value="td">
                        <TapDanceTab
                            service={service}
                            count={counts.tapDance}
                        />
                    </TabsContent>
                )}
                {counts.combo > 0 && (
                    <TabsContent value="combo">
                        <ComboTab service={service} count={counts.combo} />
                    </TabsContent>
                )}
                {counts.keyOverride > 0 && (
                    <TabsContent value="ko">
                        <KeyOverrideTab
                            service={service}
                            count={counts.keyOverride}
                        />
                    </TabsContent>
                )}
                {hasARK && (
                    <TabsContent value="ark">
                        <AltRepeatKeyTab service={service} />
                    </TabsContent>
                )}
            </Tabs>
        </Modal>
    )
}
