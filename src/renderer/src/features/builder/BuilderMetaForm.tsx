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
import {
    Bluetooth,
    Check,
    CheckCircle2,
    TriangleAlert,
    Usb,
    Wand2,
} from 'lucide-react'
import { Switch } from '@/ui/switch'
import useBuilderStore from '@/stores/builderStore'
import useConfigStore from '@/stores/configStore'
import type {
    CanonController,
    CanonLighting,
    CanonVial,
    ConfigKeymap,
    ConfigMeta,
    ConfigKeyboard,
} from '@firmware/config'
import {
    KNOWN_ZMK_BOARDS,
    checkCompleteness,
    materializeMatrix,
} from '@firmware/config'
import { matrixDims } from './builderMatrix'
import { rowPins, colPins, setRowPinsText, setColPinsText } from './builderPins'
import { setMatrixMeta } from './builderInspectorOps'

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

// pattern-check: skip additive optional `list` (datalist) prop, presentational
/** Text input that holds a local draft and commits (with history) on blur/Enter. */
function TextField({
    value,
    onCommit,
    placeholder,
    mono,
    list,
}: {
    value: string
    onCommit: (v: string) => void
    placeholder?: string
    mono?: boolean
    list?: string
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
            list={list}
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

/* ── Vial security helpers (pure) ──────────────────────────────────────── */
// pattern-check: skip pure UID/unlock-combo formatters + parsers, no abstraction

const uidToHex = (uid?: number[]): string =>
    (uid ?? [])
        .map(
            (b) =>
                '0x' + (b & 0xff).toString(16).toUpperCase().padStart(2, '0'),
        )
        .join(' ')

/** Parse 8 hex/decimal bytes from free text; undefined unless exactly 8 valid. */
const parseUid = (s: string): number[] | undefined => {
    const bytes = s
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((t) => Number(t))
    return bytes.length === 8 &&
        bytes.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)
        ? bytes
        : undefined
}

const randomUid = (): number[] =>
    Array.from({ length: 8 }, () => Math.floor(Math.random() * 256))

const unlockToText = (keys?: [number, number][]): string =>
    (keys ?? []).map(([r, c]) => `${r},${c}`).join(' ')

/** Parse "r,c r,c …" into matrix positions, dropping malformed entries. */
const parseUnlock = (s: string): [number, number][] =>
    s
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => p.split(',').map(Number) as [number, number])
        .filter(
            ([r, c]) =>
                Number.isInteger(r) && Number.isInteger(c) && r >= 0 && c >= 0,
        )

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

    // "Auto" freezes the derived [row,col] into every key + the board descriptor.
    const onAutoMatrix = (): void => commit(materializeMatrix(config))

    // Controller-identity writer — drop empties so a keymap-only config stays clean.
    const ctrl = kb.controller
    const setController = (p: Partial<CanonController>): void => {
        const next: CanonController = { ...ctrl, ...p }
        for (const k of Object.keys(next) as (keyof CanonController)[])
            if (!next[k]) delete next[k]
        patchKeyboard({
            controller: Object.keys(next).length ? next : undefined,
        })
    }

    // Controller fields are firmware-aware: ZMK uses board (+ shield), the QMK
    // family (qmk/via/vial) uses processor/bootloader/dev-board + USB device
    // version. With nothing selected yet, show everything.
    const noFw = targets.length === 0
    const showZmkCtrl = noFw || targets.includes('zmk')
    const showQmkCtrl = noFw || targets.some((f) => f !== 'zmk')

    // Vial security writer — drop empty fields so a keymap-only config stays clean.
    const vial = kb.vial
    const setVial = (p: Partial<CanonVial>): void => {
        const next: CanonVial = { ...vial, ...p }
        if (!next.uid?.length) delete next.uid
        if (!next.unlockKeys?.length) delete next.unlockKeys
        if (!next.insecure) delete next.insecure
        patchKeyboard({ vial: Object.keys(next).length ? next : undefined })
    }

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

            {/* Controller — pattern-check: skip presentational form section */}
            <div>
                <MiniLabel>Controller</MiniLabel>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <div className="mb-1 text-[11px] text-muted-foreground">
                            Board
                        </div>
                        <TextField
                            mono
                            list="zmk-boards"
                            value={ctrl?.board ?? kb.hardware?.board ?? ''}
                            onCommit={(v) =>
                                setController({ board: v.trim() || undefined })
                            }
                            placeholder="nice_nano_v2"
                        />
                        <datalist id="zmk-boards">
                            {KNOWN_ZMK_BOARDS.map((b) => (
                                <option key={b} value={b} />
                            ))}
                        </datalist>
                    </div>
                    {/* firmware-gated fields — // pattern-check: skip presentational */}
                    {showZmkCtrl && (
                        <div>
                            <div className="mb-1 text-[11px] text-muted-foreground">
                                Shield (opt.)
                            </div>
                            <TextField
                                mono
                                value={
                                    ctrl?.shield ?? kb.hardware?.shield ?? ''
                                }
                                onCommit={(v) =>
                                    setController({
                                        shield: v.trim() || undefined,
                                    })
                                }
                                placeholder="corne_left"
                            />
                        </div>
                    )}
                    {showQmkCtrl && (
                        <div>
                            <div className="mb-1 text-[11px] text-muted-foreground">
                                Processor (QMK)
                            </div>
                            <TextField
                                mono
                                value={ctrl?.processor ?? ''}
                                onCommit={(v) =>
                                    setController({
                                        processor: v.trim() || undefined,
                                    })
                                }
                                placeholder="atmega32u4"
                            />
                        </div>
                    )}
                    {showQmkCtrl && (
                        <div>
                            <div className="mb-1 text-[11px] text-muted-foreground">
                                Bootloader (QMK)
                            </div>
                            <TextField
                                mono
                                value={ctrl?.bootloader ?? ''}
                                onCommit={(v) =>
                                    setController({
                                        bootloader: v.trim() || undefined,
                                    })
                                }
                                placeholder="atmel-dfu"
                            />
                        </div>
                    )}
                    {showQmkCtrl && (
                        <div>
                            <div className="mb-1 text-[11px] text-muted-foreground">
                                Dev board (QMK)
                            </div>
                            <TextField
                                mono
                                value={ctrl?.developmentBoard ?? ''}
                                onCommit={(v) =>
                                    setController({
                                        developmentBoard: v.trim() || undefined,
                                    })
                                }
                                placeholder="promicro"
                            />
                        </div>
                    )}
                    {showQmkCtrl && (
                        <div>
                            <div className="mb-1 text-[11px] text-muted-foreground">
                                Device version
                            </div>
                            <TextField
                                mono
                                value={ctrl?.deviceVersion ?? ''}
                                onCommit={(v) =>
                                    setController({
                                        deviceVersion: v.trim() || undefined,
                                    })
                                }
                                placeholder="1.0.0"
                            />
                        </div>
                    )}
                </div>
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                    {showZmkCtrl && !showQmkCtrl
                        ? 'ZMK uses board + optional shield. Lets remappr emit a flashable project.'
                        : showQmkCtrl && !showZmkCtrl
                          ? 'QMK uses processor + bootloader (or a dev-board shortcut) + USB device version.'
                          : 'ZMK uses board (+ shield); QMK uses processor + bootloader (or a dev-board shortcut).'}
                </p>
            </div>

            {/* Vial security — // pattern-check: skip presentational form section */}
            {targets.includes('vial') && (
                <div>
                    <MiniLabel>Vial security</MiniLabel>
                    <div className="mb-1 text-[11px] text-muted-foreground">
                        Keyboard UID (8 bytes)
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <TextField
                                mono
                                value={uidToHex(vial?.uid)}
                                onCommit={(v) => setVial({ uid: parseUid(v) })}
                                placeholder="0xFE 0x06 0xBF …"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setVial({ uid: randomUid() })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-[12px] font-semibold text-foreground hover:border-primary"
                        >
                            <Wand2 size={13} /> Generate
                        </button>
                    </div>
                    <div className="mt-2.5 mb-1 text-[11px] text-muted-foreground">
                        Unlock combo (row,col …)
                    </div>
                    <TextField
                        mono
                        value={unlockToText(vial?.unlockKeys)}
                        onCommit={(v) =>
                            setVial({ unlockKeys: parseUnlock(v) })
                        }
                        placeholder="0,0 0,1"
                    />
                    <div className="mt-2.5">
                        <ToggleRow
                            on={!!vial?.insecure}
                            onToggle={(v) =>
                                setVial({ insecure: v || undefined })
                            }
                            label="Insecure (no unlock required)"
                        />
                    </div>
                    <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                        Vial ties a flashed board to its definition by UID and
                        locks the keymap until the unlock keys are held. Emitted
                        to the vial keymap&apos;s config.h.
                    </p>
                </div>
            )}

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
                            {kb.keys.some((k) => k.matrix) ? ' · wired' : ''}
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
                {/* Diode direction + scan mode (board matrix descriptor) */}
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <div>
                        <div className="mb-1 text-[11px] text-muted-foreground">
                            Diode direction
                        </div>
                        <select
                            value={kb.matrix?.diodeDirection ?? 'col2row'}
                            onChange={(e) =>
                                commit(
                                    setMatrixMeta(config, {
                                        diodeDirection: e.target.value as
                                            | 'row2col'
                                            | 'col2row',
                                    }),
                                )
                            }
                            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 font-mono text-[12px] font-semibold text-foreground outline-none focus:border-primary"
                        >
                            <option value="col2row">COL2ROW</option>
                            <option value="row2col">ROW2COL</option>
                        </select>
                    </div>
                    <div>
                        <div className="mb-1 text-[11px] text-muted-foreground">
                            Scan mode
                        </div>
                        <select
                            value={kb.matrix?.mode ?? 'matrix'}
                            onChange={(e) =>
                                commit(
                                    setMatrixMeta(config, {
                                        mode: e.target.value as
                                            | 'matrix'
                                            | 'direct',
                                    }),
                                )
                            }
                            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 font-mono text-[12px] font-semibold text-foreground outline-none focus:border-primary"
                        >
                            <option value="matrix">Matrix (row × col)</option>
                            <option value="direct">Direct (1 GPIO/key)</option>
                        </select>
                    </div>
                </div>
                {/* Pin mapping (friendly labels → kscan) */}
                <div className="mt-2.5 text-[11px] text-muted-foreground">
                    Pin mapping
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                    <TextField
                        mono
                        value={rowPins(config).join(' ')}
                        onCommit={(v) => commit(setRowPinsText(config, v))}
                        placeholder="row pins"
                    />
                    <TextField
                        mono
                        value={colPins(config).join(' ')}
                        onCommit={(v) => commit(setColPinsText(config, v))}
                        placeholder="col pins"
                    />
                </div>
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

            {/* Firmware readiness — // pattern-check: skip presentational checklist */}
            <div>
                <MiniLabel>Readiness</MiniLabel>
                <div className="flex flex-col gap-1.5">
                    {checkCompleteness(config).map((r) => (
                        <div
                            key={r.firmware}
                            className="rounded-[9px] border border-border bg-background px-2.5 py-2"
                        >
                            <div className="flex items-center gap-1.5 text-[12px] font-bold">
                                {r.ready ? (
                                    <CheckCircle2
                                        size={14}
                                        className="text-emerald-500"
                                    />
                                ) : (
                                    <TriangleAlert
                                        size={14}
                                        className="text-red-500"
                                    />
                                )}
                                {r.label}
                                <span className="text-[10.5px] font-normal text-muted-foreground">
                                    {r.ready ? 'ready' : 'needs setup'}
                                </span>
                            </div>
                            {r.issues.length > 0 && (
                                <ul className="mt-1 space-y-0.5 pl-[19px] text-[10.5px] leading-snug">
                                    {r.issues.map((i, idx) => (
                                        <li
                                            key={idx}
                                            data-level={i.level}
                                            className="text-muted-foreground data-[level=error]:text-red-400"
                                        >
                                            {i.message}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
