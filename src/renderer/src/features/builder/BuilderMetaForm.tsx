// Pattern check: no GoF pattern (-) — rejected — presentational meta-form bound to
// configStore (identity / USB / firmware targets / matrix / capabilities / lighting)
// with local form controls + a pure firmware-type mapper; UI component, no abstraction.
//
// The left-panel keyboard-identity form, ported from app/builder/BuilderPanels.jsx
// (MetaForm + LightingSection). Writes straight into the canonical config
// (configStore is the source of truth) through builderStore.commit so every edit
// joins the undo history. Text inputs commit on blur (one history entry per edit);
// toggles / cards / sliders commit immediately (sliders coalesce a drag via arm).
import { useEffect, useRef, useState } from 'react'
import { Bluetooth, Check, Usb, Wand2 } from 'lucide-react'
import { Switch } from '@/ui/switch'
import useBuilderStore from '@/stores/builderStore'
import useConfigStore from '@/stores/configStore'
import type {
    CanonLighting,
    ConfigKeymap,
    ConfigMeta,
    ConfigKeyboard,
} from '@firmware/config'
import { autoMatrix, matrixDims } from './builderMatrix'

/* ── firmware targets ──────────────────────────────────────────────────── */
interface Firmware {
    id: string
    name: string
    blurb: string
    wireless: boolean
}
const FIRMWARES: Firmware[] = [
    {
        id: 'qmk',
        name: 'QMK',
        blurb: 'C firmware · info.json + keymap',
        wireless: false,
    },
    {
        id: 'via',
        name: 'VIA',
        blurb: 'Live remap · v3 definition',
        wireless: false,
    },
    {
        id: 'vial',
        name: 'Vial',
        blurb: 'On-device · VIA + vial.json',
        wireless: false,
    },
    {
        id: 'zmk',
        name: 'ZMK',
        blurb: 'Wireless · devicetree keymap',
        wireless: true,
    },
]

/** The keyboard "type" implied by the selected firmware targets. */
function keyboardTypeFor(targets: string[]): {
    conn: string
    wireless: boolean
    label: string
} {
    const t = targets.length ? targets : ['qmk']
    const anyWireless = t.some(
        (id) => FIRMWARES.find((f) => f.id === id)?.wireless,
    )
    const names = t
        .map((id) => FIRMWARES.find((f) => f.id === id)?.name)
        .filter(Boolean)
    return {
        conn: anyWireless
            ? t.length > 1
                ? 'Wired + wireless'
                : 'Wireless (BLE)'
            : 'Wired (USB)',
        wireless: anyWireless,
        label: names.join(' + ') || 'Custom',
    }
}

const LIGHTING_EFFECTS = ['solid', 'breathe', 'rainbow', 'swirl', 'gradient']
const HUE_SWATCHES: (number | undefined)[] = [undefined, 25, 90, 152, 250, 300]

/* ── small form controls ───────────────────────────────────────────────── */
function MiniLabel({ children }: { children: React.ReactNode }): JSX.Element {
    return (
        <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            {children}
        </div>
    )
}

/** Text input that holds a local draft and commits (with history) on blur/Enter. */
function TextField({
    value,
    onCommit,
    placeholder,
    mono,
}: {
    value: string
    onCommit: (v: string) => void
    placeholder?: string
    mono?: boolean
}): JSX.Element {
    const [draft, setDraft] = useState(value)
    const dirty = useRef(false)
    // Keep the draft in sync when the underlying value changes externally.
    useEffect(() => {
        if (!dirty.current) setDraft(value)
    }, [value])
    const flush = (): void => {
        dirty.current = false
        if (draft !== value) onCommit(draft)
    }
    return (
        <input
            value={draft}
            placeholder={placeholder}
            onChange={(e) => {
                dirty.current = true
                setDraft(e.target.value)
            }}
            onBlur={flush}
            onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            className={`w-full rounded-lg border border-input bg-background px-2.5 py-2 text-[13px] font-medium text-foreground outline-none focus:border-primary ${mono ? 'font-mono' : ''}`}
        />
    )
}

function ToggleRow({
    on,
    onToggle,
    label,
}: {
    on: boolean
    onToggle: (v: boolean) => void
    label: string
}): JSX.Element {
    return (
        <label className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-2.5 py-2">
            <span className="text-[13px] font-medium">{label}</span>
            <Switch checked={on} onCheckedChange={onToggle} />
        </label>
    )
}

/** Range slider that coalesces a drag into one history entry: it arms on
 *  mousedown and ends the gesture on release; `onChange` should route through
 *  builderStore.liveCommit so the first tick pushes one snapshot. */
function HistorySlider({
    value,
    onChange,
}: {
    value: number
    onChange: (v: number) => void
}): JSX.Element {
    const arm = useBuilderStore((s) => s.arm)
    const endGesture = useBuilderStore((s) => s.endGesture)
    return (
        <input
            type="range"
            min={0}
            max={100}
            value={value}
            onMouseDown={arm}
            onChange={(e) => onChange(Number(e.target.value))}
            onMouseUp={endGesture}
            onBlur={endGesture}
            className="w-full accent-primary"
        />
    )
}

/* ── the form ──────────────────────────────────────────────────────────── */
export function BuilderMetaForm(): JSX.Element {
    const config = useConfigStore((s) => s.config)
    const commit = useBuilderStore((s) => s.commit)
    const liveCommit = useBuilderStore((s) => s.liveCommit)

    if (!config) return <div />

    const meta = config.meta
    const kb = config.keyboard
    const dims = matrixDims(config)
    const targets = kb.firmware ?? []
    const kt = keyboardTypeFor(targets)
    const L: CanonLighting = kb.lighting ?? {}

    const patchMeta = (p: Partial<ConfigMeta>): void =>
        commit({ ...config, meta: { ...meta, ...p } })
    const patchKeyboard = (p: Partial<ConfigKeyboard>): void =>
        commit({ ...config, keyboard: { ...kb, ...p } })
    // Name is mirrored on meta + keyboard — patch both in one commit.
    const patchName = (v: string): void => {
        const name = v.trim() || 'My Keyboard'
        commit({
            ...config,
            meta: { ...meta, name },
            keyboard: { ...kb, name },
        })
    }

    const toggleTarget = (id: string): void => {
        const set = new Set(targets)
        if (set.has(id)) set.delete(id)
        else set.add(id)
        const next = [...set]
        patchKeyboard({ firmware: next.length ? next : undefined })
    }

    const onAutoMatrix = (): void =>
        patchKeyboard({
            hardware: { ...kb.hardware, transform: autoMatrix(kb.keys) },
        })

    // Lighting writers. `commit` for discrete edits, `liveCommit` for slider drags.
    const setLighting = (
        next: CanonLighting | undefined,
        live = false,
    ): void => {
        const nextConfig: ConfigKeymap = {
            ...config,
            keyboard: { ...kb, lighting: next },
        }
        ;(live ? liveCommit : commit)(nextConfig)
    }
    const setUnder = (
        p: Partial<NonNullable<CanonLighting['underglow']>> | null,
        live = false,
    ): void => {
        if (p === null) {
            const rest = { ...L }
            delete rest.underglow
            setLighting(Object.keys(rest).length ? rest : undefined)
            return
        }
        setLighting({ ...L, underglow: { ...L.underglow, ...p } }, live)
    }
    const setBack = (
        p: Partial<NonNullable<CanonLighting['backlight']>> | null,
        live = false,
    ): void => {
        if (p === null) {
            const rest = { ...L }
            delete rest.backlight
            setLighting(Object.keys(rest).length ? rest : undefined)
            return
        }
        setLighting({ ...L, backlight: { ...L.backlight, ...p } }, live)
    }

    return (
        <div className="flex flex-col gap-[18px]">
            {/* Identity */}
            <div>
                <MiniLabel>Identity</MiniLabel>
                <div className="flex flex-col gap-2">
                    <TextField
                        value={meta.name}
                        onCommit={patchName}
                        placeholder="Keyboard name"
                    />
                    <TextField
                        value={meta.author ?? ''}
                        onCommit={(v) => patchMeta({ author: v || undefined })}
                        placeholder="Author / maintainer"
                    />
                </div>
            </div>

            {/* USB identifiers */}
            <div>
                <MiniLabel>USB identifiers</MiniLabel>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <div className="mb-1 text-[11px] text-muted-foreground">
                            Vendor ID
                        </div>
                        <TextField
                            mono
                            value={meta.vendorId ?? ''}
                            onCommit={(v) =>
                                patchMeta({ vendorId: v || undefined })
                            }
                            placeholder="0xFEED"
                        />
                    </div>
                    <div>
                        <div className="mb-1 text-[11px] text-muted-foreground">
                            Product ID
                        </div>
                        <TextField
                            mono
                            value={meta.productId ?? ''}
                            onCommit={(v) =>
                                patchMeta({ productId: v || undefined })
                            }
                            placeholder="0x0001"
                        />
                    </div>
                </div>
            </div>

            {/* Firmware targets */}
            <div>
                <MiniLabel>Firmware targets</MiniLabel>
                <div className="grid grid-cols-2 gap-[7px]">
                    {FIRMWARES.map((f) => {
                        const on = targets.includes(f.id)
                        return (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => toggleTarget(f.id)}
                                className="rounded-[9px] px-2.5 py-2 text-left text-foreground transition-colors"
                                style={{
                                    background: on
                                        ? 'color-mix(in oklch, var(--primary) 16%, var(--background))'
                                        : 'var(--background)',
                                    border: `1px solid ${on ? 'color-mix(in oklch, var(--primary) 50%, transparent)' : 'var(--border)'}`,
                                }}
                            >
                                <div className="flex items-center gap-1.5 text-[13px] font-bold">
                                    {f.name}
                                    {on && (
                                        <Check
                                            size={13}
                                            className="ml-auto text-primary"
                                        />
                                    )}
                                </div>
                                <div className="mt-px text-[10.5px] text-muted-foreground">
                                    {f.blurb}
                                </div>
                            </button>
                        )
                    })}
                </div>
                <div
                    className="mt-2 flex items-center gap-2 rounded-[9px] px-2.5 py-2"
                    style={{
                        background:
                            'color-mix(in oklch, var(--primary) 7%, var(--background))',
                        border: '1px solid color-mix(in oklch, var(--primary) 22%, transparent)',
                    }}
                >
                    {kt.wireless ? (
                        <Bluetooth size={14} className="text-primary" />
                    ) : (
                        <Usb size={14} className="text-primary" />
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-bold">
                            Keyboard type · {kt.conn}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground">
                            Keycodes &amp; behaviours follow {kt.label}
                        </div>
                    </div>
                </div>
            </div>

            {/* Matrix */}
            <div>
                <MiniLabel>Matrix</MiniLabel>
                <div className="flex items-center gap-2.5 rounded-[9px] border border-border bg-background px-3 py-2.5">
                    <div className="flex-1">
                        <div className="font-mono text-[13px] font-bold">
                            {dims.rows} × {dims.cols}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                            rows × columns · {kb.keys.length} keys
                            {kb.hardware?.transform ? ' · wired' : ''}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onAutoMatrix}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-[12px] font-semibold text-foreground hover:border-primary"
                    >
                        <Wand2 size={13} /> Auto
                    </button>
                </div>
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                    Auto assigns each key&apos;s row/column from its position.
                    Per-key wiring lands in the inspector.
                </p>
            </div>

            {/* Capabilities */}
            <div>
                <MiniLabel>Capabilities</MiniLabel>
                <ToggleRow
                    on={!!kb.split}
                    onToggle={(v) => patchKeyboard({ split: v || undefined })}
                    label="Split / two-piece"
                />
            </div>

            {/* Lighting */}
            <div>
                <MiniLabel>Lighting</MiniLabel>
                <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
                    Configured for every firmware target — the exporter maps it
                    to each platform.
                </p>
                <div className="flex flex-col gap-[7px]">
                    <ToggleRow
                        on={!!L.underglow}
                        onToggle={(v) => setUnder(v ? {} : null)}
                        label="RGB underglow"
                    />
                    {L.underglow && (
                        <div className="flex flex-col gap-2.5 rounded-[9px] border border-border bg-background px-2.5 py-2.5">
                            <div>
                                <div className="mb-1.5 text-[11px] text-muted-foreground">
                                    Effect
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {LIGHTING_EFFECTS.map((e) => {
                                        const on =
                                            (L.underglow?.effect ?? 'solid') ===
                                            e
                                        return (
                                            <button
                                                key={e}
                                                type="button"
                                                onClick={() =>
                                                    setUnder({ effect: e })
                                                }
                                                className="rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize text-foreground"
                                                style={{
                                                    background: on
                                                        ? 'color-mix(in oklch, var(--primary) 18%, var(--background))'
                                                        : 'var(--secondary)',
                                                    border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                                                }}
                                            >
                                                {e}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div>
                                <div className="mb-1.5 text-[11px] text-muted-foreground">
                                    Color
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {HUE_SWATCHES.map((h, i) => {
                                        const on = L.underglow?.hue === h
                                        return (
                                            <button
                                                key={i}
                                                type="button"
                                                aria-label={
                                                    h == null
                                                        ? 'Rainbow'
                                                        : `Hue ${h}`
                                                }
                                                onClick={() =>
                                                    setUnder({ hue: h })
                                                }
                                                className="size-[22px] rounded-md p-0"
                                                style={{
                                                    border: `2px solid ${on ? 'var(--foreground)' : 'transparent'}`,
                                                    background:
                                                        h == null
                                                            ? 'linear-gradient(90deg,#ff4d4d,#ffd24d,#4dff7a,#4dd2ff,#b14dff)'
                                                            : `oklch(0.7 0.2 ${h})`,
                                                }}
                                            />
                                        )
                                    })}
                                </div>
                            </div>
                            <div>
                                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                                    <span>Brightness</span>
                                    <span className="font-mono text-foreground">
                                        {L.underglow?.brightness ?? 80}%
                                    </span>
                                </div>
                                <HistorySlider
                                    value={L.underglow?.brightness ?? 80}
                                    onChange={(v) =>
                                        setUnder({ brightness: v }, true)
                                    }
                                />
                            </div>
                        </div>
                    )}
                    <ToggleRow
                        on={!!L.backlight}
                        onToggle={(v) => setBack(v ? {} : null)}
                        label="Per-key backlight"
                    />
                    {L.backlight && (
                        <div className="rounded-[9px] border border-border bg-background px-2.5 py-2.5">
                            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                                <span>Backlight brightness</span>
                                <span className="font-mono text-foreground">
                                    {L.backlight?.brightness ?? 70}%
                                </span>
                            </div>
                            <HistorySlider
                                value={L.backlight?.brightness ?? 70}
                                onChange={(v) =>
                                    setBack({ brightness: v }, true)
                                }
                            />
                            <div className="mt-2">
                                <ToggleRow
                                    on={!!L.backlight?.breathing}
                                    onToggle={(v) =>
                                        setBack({ breathing: v || undefined })
                                    }
                                    label="Breathing"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
