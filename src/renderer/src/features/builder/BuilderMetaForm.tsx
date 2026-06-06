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
    Plus,
    Trash2,
    TriangleAlert,
    Usb,
    Wand2,
    X,
    XCircle,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { Switch } from '@/ui/switch'
import useBuilderStore from '@/stores/builderStore'
import useConfigStore from '@/stores/configStore'
import type {
    CanonController,
    CanonFirmwareConfig,
    CanonLayoutOption,
    CanonLighting,
    CanonVial,
    ConfigHardware,
    ConfigKeyboard,
    ConfigKeymap,
    ConfigMeta,
} from '@firmware/config'
import {
    BUILDER_FIRMWARE_TARGETS,
    checkCompleteness,
    deriveQmkConfigH,
    deriveQmkRulesMk,
    deriveZmkConf,
    KNOWN_ZMK_BOARDS,
    materializeMatrix,
    parseUid,
    parseUnlock,
    randomUid,
    resolveZmkConfFlags,
    uidToHex,
    unlockToText,
} from '@firmware/config'
import { MiniLabel } from './MiniLabel'
import { displayMatrixDims } from './builderMatrix'
import { colPins, rowPins, setColPinsText, setRowPinsText } from './builderPins'
import { keyMatrix, setMatrixMeta } from './builderInspectorOps'

/* ── firmware targets ──────────────────────────────────────────────────── */

// pattern-check: skip — firmware-target descriptor table moved to @firmware/config/firmwareTargets
/** The keyboard "type" implied by the selected firmware targets. */
function keyboardTypeFor(targets: string[]): {
    conn: string
    wireless: boolean
    label: string
} {
    const t = targets.length ? targets : ['qmk']
    const anyWireless = t.some(
        (id) => BUILDER_FIRMWARE_TARGETS.find((f) => f.id === id)?.wireless,
    )
    const names = t
        .map((id) => BUILDER_FIRMWARE_TARGETS.find((f) => f.id === id)?.name)
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

// pattern-check: skip presentational multiline input mirroring TextField, no abstraction
/** Multiline draft input; commits (with history) on blur. */
function TextArea({
    value,
    onCommit,
    placeholder,
    rows = 4,
}: {
    value: string
    onCommit: (v: string) => void
    placeholder?: string
    rows?: number
}): JSX.Element {
    const [draft, setDraft] = useState(value)
    const dirty = useRef(false)
    useEffect(() => {
        if (!dirty.current) setDraft(value)
    }, [value])
    return (
        <textarea
            value={draft}
            placeholder={placeholder}
            rows={rows}
            spellCheck={false}
            onChange={(e) => {
                dirty.current = true
                setDraft(e.target.value)
            }}
            onBlur={() => {
                dirty.current = false
                if (draft !== value) onCommit(draft)
            }}
            className="w-full resize-y rounded-lg border border-input bg-background px-2.5 py-2 font-mono text-[12px] leading-snug text-foreground outline-none focus:border-primary"
        />
    )
}

/** Read-only generated-file preview (live .conf / config.h / rules.mk). */
function FilePreview({ text }: { text: string }): JSX.Element {
    return (
        <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-muted/40 px-2.5 py-2 font-mono text-[11px] leading-snug text-muted-foreground">
            {text}
        </pre>
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
    const selection = useBuilderStore((s) => s.selection)

    if (!config) return <div />

    const meta = config.meta
    const kb = config.keyboard
    const dims = displayMatrixDims(config)
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

    // pattern-check: skip presentational selection→config writers for the unlock + layout-option pickers, no abstraction
    // Selected key indices (into keys[]), clamped to the current board.
    const selKeys = [...selection].filter((i) => i < kb.keys.length)
    // Selected keys' [row,col] (the matrix positions Vial's unlock combo + the
    // visual picker speak in). Deduped against what's already in the combo.
    const keyAt = (i: number): [number, number] => keyMatrix(config, i)
    const addUnlockSelected = (): void => {
        const have = new Set(
            (vial?.unlockKeys ?? []).map(([r, c]) => `${r},${c}`),
        )
        const add = selKeys
            .map(keyAt)
            .filter(([r, c]) => !have.has(`${r},${c}`))
        if (add.length)
            setVial({ unlockKeys: [...(vial?.unlockKeys ?? []), ...add] })
    }
    const removeUnlockAt = (idx: number): void =>
        setVial({
            unlockKeys: (vial?.unlockKeys ?? []).filter((_k, i) => i !== idx),
        })

    // Layout-options writers. Removing an option also fixes up `keys[].option`:
    // keys tagged to it lose the tag, and tags above it shift down a group.
    type CanonKey = ConfigKeyboard['keys'][number]
    const stripOption = (k: CanonKey): CanonKey => {
        if (!k.option) return k
        const rest = { ...k }
        delete rest.option
        return rest
    }
    const opts = kb.layoutOptions ?? []
    const setOptions = (next: CanonLayoutOption[]): void =>
        patchKeyboard({ layoutOptions: next.length ? next : undefined })
    const patchOption = (g: number, p: Partial<CanonLayoutOption>): void =>
        setOptions(opts.map((o, i) => (i === g ? { ...o, ...p } : o)))
    const addOption = (): void =>
        setOptions([...opts, { label: `Option ${opts.length + 1}` }])
    const removeOption = (g: number): void => {
        const keys = kb.keys.map((k) => {
            if (!k.option) return k
            const [grp, ch] = k.option
            if (grp === g) return stripOption(k)
            return grp > g
                ? { ...k, option: [grp - 1, ch] as [number, number] }
                : k
        })
        commit({
            ...config,
            keyboard: {
                ...kb,
                keys,
                layoutOptions:
                    opts.length > 1
                        ? opts.filter((_o, i) => i !== g)
                        : undefined,
            },
        })
    }
    // Tag / untag the selected keys to a (group, choice) layout-option variant.
    const tagSelected = (g: number, choice: number): void => {
        const sel = new Set(selKeys)
        patchKeyboard({
            keys: kb.keys.map((k, i) =>
                sel.has(i)
                    ? { ...k, option: [g, choice] as [number, number] }
                    : k,
            ),
        })
    }
    const untagSelected = (): void => {
        const sel = new Set(selKeys)
        patchKeyboard({
            keys: kb.keys.map((k, i) => (sel.has(i) ? stripOption(k) : k)),
        })
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

    // Firmware-config writer — merge a patch, drop empty/false-y string fields so a
    // bare config stays clean; tri-state booleans keep their explicit value.
    const fc: CanonFirmwareConfig = kb.firmwareConfig ?? {}
    const zmkFlags = resolveZmkConfFlags(config)
    const setFirmwareConfig = (p: Partial<CanonFirmwareConfig>): void => {
        const next: CanonFirmwareConfig = { ...fc, ...p }
        for (const k of Object.keys(next) as (keyof CanonFirmwareConfig)[]) {
            const v = next[k]
            if (v === undefined || v === '') delete next[k]
        }
        patchKeyboard({
            firmwareConfig: Object.keys(next).length ? next : undefined,
        })
    }

    // Hardware-peripheral writers — patch keyboard.hardware, drop empty sub-objects.
    const hw: ConfigHardware = kb.hardware ?? {}
    const setHardware = (p: Partial<ConfigHardware>): void => {
        const next: ConfigHardware = { ...hw, ...p }
        for (const k of Object.keys(next) as (keyof ConfigHardware)[])
            if (next[k] === undefined) delete next[k]
        patchKeyboard({ hardware: Object.keys(next).length ? next : undefined })
    }
    const setBacklightPwm = (
        p: Partial<NonNullable<ConfigHardware['backlightPwm']>> | null,
    ): void => {
        if (p === null) return setHardware({ backlightPwm: undefined })
        const cur = hw.backlightPwm ?? { instance: 'pwm0', channel: 0, pin: '' }
        setHardware({ backlightPwm: { ...cur, ...p } })
    }
    const setWs2812 = (
        p: Partial<NonNullable<ConfigHardware['ws2812']>> | null,
    ): void => {
        if (p === null) return setHardware({ ws2812: undefined })
        const cur = hw.ws2812 ?? { spi: 'spi3', dataPin: '', chainLength: 10 }
        setHardware({ ws2812: { ...cur, ...p } })
    }
    const setExtPowerCtrl = (
        p: Partial<NonNullable<ConfigHardware['extPowerCtrl']>> | null,
    ): void => {
        if (p === null) return setHardware({ extPowerCtrl: undefined })
        const cur = hw.extPowerCtrl ?? { controlGpio: '' }
        setHardware({ extPowerCtrl: { ...cur, ...p } })
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
                    {BUILDER_FIRMWARE_TARGETS.map((f) => {
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
                    {/* visual picker — // pattern-check: skip presentational chips + add-selected control */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {(vial?.unlockKeys ?? []).map(([r, c], i) => (
                            <span
                                key={`${r},${c},${i}`}
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-1.5 py-0.5 font-mono text-[11px]"
                            >
                                {r},{c}
                                <button
                                    type="button"
                                    onClick={() => removeUnlockAt(i)}
                                    className="text-muted-foreground hover:text-foreground"
                                    aria-label={`Remove unlock key ${r},${c}`}
                                >
                                    <X size={11} />
                                </button>
                            </span>
                        ))}
                        <button
                            type="button"
                            onClick={addUnlockSelected}
                            disabled={selKeys.length === 0}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] font-semibold hover:border-primary disabled:opacity-40"
                        >
                            <Plus size={11} /> Add selected ({selKeys.length})
                        </button>
                    </div>
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
                        to the vial keymap&apos;s config.h. Select keys on the
                        board, then “Add selected”.
                    </p>
                </div>
            )}

            {/* Layout options — // pattern-check: skip presentational VIA/Vial layout-option editor */}
            {targets.some((t) => t === 'via' || t === 'vial') && (
                <div>
                    <MiniLabel>Layout options</MiniLabel>
                    <p className="mb-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                        VIA/Vial variants. A blank choices field is an on/off
                        toggle; two or more comma-separated choices make a
                        dropdown. Tag keys so they appear only in a chosen
                        variant.
                    </p>
                    {opts.length === 0 && (
                        <div className="mb-1.5 text-[11px] text-muted-foreground">
                            No layout options yet.
                        </div>
                    )}
                    {opts.map((o, g) => (
                        <div
                            key={g}
                            className="mb-2 rounded-lg border border-border bg-background p-2"
                        >
                            <div className="flex items-center gap-2">
                                <div className="flex-1">
                                    <TextField
                                        value={o.label}
                                        onCommit={(v) =>
                                            patchOption(g, {
                                                label:
                                                    v.trim() ||
                                                    `Option ${g + 1}`,
                                            })
                                        }
                                        placeholder="Option label"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeOption(g)}
                                    className="rounded-md border border-border bg-secondary p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive"
                                    aria-label={`Remove option ${o.label}`}
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                            <div className="mt-1.5">
                                <TextField
                                    value={(o.choices ?? []).join(', ')}
                                    onCommit={(v) => {
                                        const arr = v
                                            .split(',')
                                            .map((s) => s.trim())
                                            .filter(Boolean)
                                        patchOption(g, {
                                            choices:
                                                arr.length >= 2
                                                    ? arr
                                                    : undefined,
                                        })
                                    }}
                                    placeholder="Choices, comma-separated (blank = toggle)"
                                />
                            </div>
                            {selKeys.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    {(o.choices ?? ['(on)']).map((ch, c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => tagSelected(g, c)}
                                            className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] font-semibold hover:border-primary"
                                        >
                                            Tag → {ch}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={addOption}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-[11px] font-semibold hover:border-primary"
                        >
                            <Plus size={12} /> Add option
                        </button>
                        {selKeys.length > 0 && opts.length > 0 && (
                            <button
                                type="button"
                                onClick={untagSelected}
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-[11px] font-semibold hover:border-primary"
                            >
                                <X size={12} /> Untag selected ({selKeys.length}
                                )
                            </button>
                        )}
                    </div>
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
                            rows × columns{dims.perHalf ? ' per half' : ''} ·{' '}
                            {kb.keys.length} keys
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

            {/* Firmware config — ZMK .conf toggles + live preview + overrides */}
            {showZmkCtrl && (
                <div>
                    <MiniLabel>Firmware config (.conf)</MiniLabel>
                    <div className="flex flex-col gap-1.5">
                        {(
                            [
                                ['usb', 'USB', zmkFlags.usb],
                                ['ble', 'Bluetooth (BLE)', zmkFlags.ble],
                                ['studio', 'ZMK Studio', zmkFlags.studio],
                                [
                                    'studioUsbCdc',
                                    'Studio over USB (CDC)',
                                    zmkFlags.studioCdc,
                                ],
                                [
                                    'studioLocking',
                                    'Studio unlock required',
                                    zmkFlags.studioLocking,
                                ],
                                ['softOff', 'Soft-off', zmkFlags.softOff],
                                [
                                    'extPower',
                                    'External power',
                                    zmkFlags.extPower,
                                ],
                                [
                                    'pointing',
                                    'Pointing (mouse)',
                                    zmkFlags.pointing,
                                ],
                                // Backlight + RGB underglow are driven by the
                                // Lighting section above (it sets the .conf flag).
                                [
                                    'usbLogging',
                                    'USB logging',
                                    zmkFlags.usbLogging,
                                ],
                            ] as [keyof CanonFirmwareConfig, string, boolean][]
                        ).map(([k, label, resolved]) => (
                            <ToggleRow
                                key={k}
                                label={label}
                                on={(fc[k] as boolean | undefined) ?? resolved}
                                onToggle={(v) =>
                                    // Studio-CDC also drives the overlay endpoint node.
                                    k === 'studioUsbCdc'
                                        ? (setFirmwareConfig({
                                              studioUsbCdc: v,
                                          }),
                                          setHardware({
                                              studioAcm: v || undefined,
                                          }))
                                        : setFirmwareConfig({ [k]: v })
                                }
                            />
                        ))}
                    </div>
                    <div className="mt-2">
                        <MiniLabel>Extra Kconfig</MiniLabel>
                        <TextArea
                            value={fc.kconfig ?? ''}
                            placeholder="CONFIG_ZMK_SLEEP=y"
                            onCommit={(v) =>
                                setFirmwareConfig({
                                    kconfig: v.trim() || undefined,
                                })
                            }
                        />
                    </div>
                    <div className="mt-2">
                        <MiniLabel>Generated .conf</MiniLabel>
                        <FilePreview text={deriveZmkConf(config)} />
                    </div>
                </div>
            )}

            {/* Hardware pins — full-parity ZMK peripheral wiring */}
            {showZmkCtrl &&
                (zmkFlags.extPower ||
                    zmkFlags.backlight ||
                    zmkFlags.underglow) && (
                    <div>
                        <MiniLabel>Hardware pins</MiniLabel>
                        <div className="flex flex-col gap-2">
                            {zmkFlags.extPower && (
                                <div className="rounded-lg border border-border p-2.5">
                                    <div className="mb-1.5 text-[11px] font-semibold text-foreground">
                                        Ext-power control GPIO
                                    </div>
                                    <TextField
                                        mono
                                        value={
                                            hw.extPowerCtrl?.controlGpio ?? ''
                                        }
                                        placeholder="P0.14"
                                        onCommit={(v) =>
                                            setExtPowerCtrl(
                                                v.trim()
                                                    ? { controlGpio: v.trim() }
                                                    : null,
                                            )
                                        }
                                    />
                                    <div className="mt-1.5">
                                        <ToggleRow
                                            label="Active low"
                                            on={!!hw.extPowerCtrl?.activeLow}
                                            onToggle={(v) =>
                                                setExtPowerCtrl({
                                                    activeLow: v || undefined,
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                            )}
                            {zmkFlags.backlight && (
                                <div className="rounded-lg border border-border p-2.5">
                                    <div className="mb-1.5 text-[11px] font-semibold text-foreground">
                                        Backlight PWM
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <TextField
                                            mono
                                            value={hw.backlightPwm?.pin ?? ''}
                                            placeholder="P0.13 (pin)"
                                            onCommit={(v) =>
                                                setBacklightPwm({
                                                    pin: v.trim(),
                                                })
                                            }
                                        />
                                        <TextField
                                            mono
                                            value={
                                                hw.backlightPwm?.instance ?? ''
                                            }
                                            placeholder="pwm0"
                                            onCommit={(v) =>
                                                setBacklightPwm({
                                                    instance:
                                                        v.trim() || 'pwm0',
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="mt-1.5">
                                        <ToggleRow
                                            label="Inverted (active-low LED)"
                                            on={!!hw.backlightPwm?.inverted}
                                            onToggle={(v) =>
                                                setBacklightPwm({
                                                    inverted: v || undefined,
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                            )}
                            {zmkFlags.underglow && (
                                <div className="rounded-lg border border-border p-2.5">
                                    <div className="mb-1.5 text-[11px] font-semibold text-foreground">
                                        WS2812 underglow
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <TextField
                                            mono
                                            value={hw.ws2812?.dataPin ?? ''}
                                            placeholder="P1.13 (data)"
                                            onCommit={(v) =>
                                                setWs2812({ dataPin: v.trim() })
                                            }
                                        />
                                        <TextField
                                            mono
                                            value={String(
                                                hw.ws2812?.chainLength ?? '',
                                            )}
                                            placeholder="LEDs"
                                            onCommit={(v) => {
                                                const n = Number(v)
                                                if (
                                                    Number.isInteger(n) &&
                                                    n > 0
                                                )
                                                    setWs2812({
                                                        chainLength: n,
                                                    })
                                            }}
                                        />
                                    </div>
                                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                                        <select
                                            value={
                                                hw.ws2812?.colorOrder ?? 'GRB'
                                            }
                                            onChange={(e) =>
                                                setWs2812({
                                                    colorOrder: e.target
                                                        .value as NonNullable<
                                                        ConfigHardware['ws2812']
                                                    >['colorOrder'],
                                                })
                                            }
                                            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 font-mono text-[12px] font-semibold text-foreground outline-none focus:border-primary"
                                        >
                                            {[
                                                'GRB',
                                                'RGB',
                                                'BGR',
                                                'RGBW',
                                                'GRBW',
                                            ].map((o) => (
                                                <option key={o} value={o}>
                                                    {o}
                                                </option>
                                            ))}
                                        </select>
                                        <TextField
                                            mono
                                            value={hw.ws2812?.spi ?? ''}
                                            placeholder="spi3"
                                            onCommit={(v) =>
                                                setWs2812({
                                                    spi: v.trim() || 'spi3',
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                            Pins like <span className="font-mono">P0.13</span>{' '}
                            emit nRF psels; verify against your board wiring.
                        </p>
                    </div>
                )}

            {/* QMK-family firmware config — config.h / rules.mk overrides + preview */}
            {showQmkCtrl && (
                <div>
                    <MiniLabel>Firmware config (config.h / rules.mk)</MiniLabel>
                    <div className="flex flex-col gap-2">
                        <div>
                            <MiniLabel>Extra config.h</MiniLabel>
                            <TextArea
                                value={fc.configH ?? ''}
                                placeholder="#define TAPPING_TERM 180"
                                onCommit={(v) =>
                                    setFirmwareConfig({
                                        configH: v.trim() || undefined,
                                    })
                                }
                            />
                        </div>
                        <div>
                            <MiniLabel>Extra rules.mk</MiniLabel>
                            <TextArea
                                value={fc.rulesMk ?? ''}
                                placeholder="MOUSEKEY_ENABLE = yes"
                                rows={3}
                                onCommit={(v) =>
                                    setFirmwareConfig({
                                        rulesMk: v.trim() || undefined,
                                    })
                                }
                            />
                        </div>
                        <div>
                            <MiniLabel>Generated config.h</MiniLabel>
                            <FilePreview text={deriveQmkConfigH(config)} />
                        </div>
                        <div>
                            <MiniLabel>Generated rules.mk</MiniLabel>
                            <FilePreview
                                text={deriveQmkRulesMk(
                                    config,
                                    targets.some(
                                        (f) => f === 'via' || f === 'vial',
                                    ),
                                    targets.includes('vial'),
                                )}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Firmware readiness — // pattern-check: skip presentational status chips */}
            <div>
                <MiniLabel>Readiness</MiniLabel>
                <div className="flex flex-wrap gap-1.5">
                    {checkCompleteness(config).map((r) => {
                        const hasError = r.issues.some(
                            (i) => i.level === 'error',
                        )
                        const status = hasError
                            ? 'error'
                            : r.issues.length > 0
                              ? 'warn'
                              : 'ok'
                        const Icon =
                            status === 'error'
                                ? XCircle
                                : status === 'warn'
                                  ? TriangleAlert
                                  : CheckCircle2
                        const tone =
                            status === 'error'
                                ? 'text-red-500'
                                : status === 'warn'
                                  ? 'text-amber-500'
                                  : 'text-emerald-500'
                        return (
                            <Tooltip key={r.firmware}>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-bold focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        <Icon size={13} className={tone} />
                                        {r.label}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent
                                    side="left"
                                    className="max-w-[220px]"
                                >
                                    {r.issues.length === 0 ? (
                                        <span>Ready to build</span>
                                    ) : (
                                        <ul className="space-y-0.5">
                                            {r.issues.map((i, idx) => (
                                                <li
                                                    key={idx}
                                                    className="flex items-start gap-1 leading-snug"
                                                >
                                                    <span
                                                        className={
                                                            i.level === 'error'
                                                                ? 'text-red-400'
                                                                : 'text-amber-400'
                                                        }
                                                    >
                                                        {i.level === 'error'
                                                            ? '✗'
                                                            : '!'}
                                                    </span>
                                                    {i.message}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </TooltipContent>
                            </Tooltip>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
