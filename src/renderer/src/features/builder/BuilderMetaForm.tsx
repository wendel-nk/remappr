// Pattern check: no GoF pattern (-) — rejected — parent presentational meta-form that
// computes the config writers and composes the extracted meta-sections; UI composition,
// no abstraction. Section JSX now lives under ./meta-sections; form controls under
// ./builderFormControls.
//
// The left-panel keyboard-identity form, ported from app/builder/BuilderPanels.jsx
// (MetaForm + LightingSection). Writes straight into the canonical config
// (configStore is the source of truth) through builderStore.commit so every edit
// joins the undo history. Text inputs commit on blur (one history entry per edit);
// toggles / cards / sliders commit immediately (sliders coalesce a drag via arm).
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
import { materializeMatrix, resolveZmkConfFlags } from '@firmware/config'
import { displayMatrixDims } from './builderMatrix'
import { keyMatrix } from './builderInspectorOps'
import { CapabilitiesSection } from './meta-sections/CapabilitiesSection'
import { ControllerSection } from './meta-sections/ControllerSection'
import { FirmwareTargetsSection } from './meta-sections/FirmwareTargetsSection'
import { IdentitySection } from './meta-sections/IdentitySection'
import { LayoutOptionsSection } from './meta-sections/LayoutOptionsSection'
import { LightingSection } from './meta-sections/LightingSection'
import { MatrixSection } from './meta-sections/MatrixSection'
import { QmkConfigSection } from './meta-sections/QmkConfigSection'
import { ReadinessSection } from './meta-sections/ReadinessSection'
import { VialSecuritySection } from './meta-sections/VialSecuritySection'
import { ZmkConfigSection } from './meta-sections/ZmkConfigSection'

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
            <IdentitySection
                meta={meta}
                patchName={patchName}
                patchMeta={patchMeta}
            />

            <FirmwareTargetsSection
                targets={targets}
                toggleTarget={toggleTarget}
            />

            <ControllerSection
                ctrl={ctrl}
                hardware={kb.hardware}
                showZmkCtrl={showZmkCtrl}
                showQmkCtrl={showQmkCtrl}
                setController={setController}
            />

            {targets.includes('vial') && (
                <VialSecuritySection
                    vial={vial}
                    setVial={setVial}
                    selKeys={selKeys}
                    addUnlockSelected={addUnlockSelected}
                    removeUnlockAt={removeUnlockAt}
                />
            )}

            {targets.some((t) => t === 'via' || t === 'vial') && (
                <LayoutOptionsSection
                    opts={opts}
                    selKeys={selKeys}
                    patchOption={patchOption}
                    removeOption={removeOption}
                    addOption={addOption}
                    tagSelected={tagSelected}
                    untagSelected={untagSelected}
                />
            )}

            <MatrixSection
                config={config}
                kb={kb}
                dims={dims}
                commit={commit}
                onAutoMatrix={onAutoMatrix}
            />

            <CapabilitiesSection
                split={!!kb.split}
                patchKeyboard={patchKeyboard}
            />

            <LightingSection L={L} setUnder={setUnder} setBack={setBack} />

            {showZmkCtrl && (
                <ZmkConfigSection
                    config={config}
                    fc={fc}
                    zmkFlags={zmkFlags}
                    hw={hw}
                    setFirmwareConfig={setFirmwareConfig}
                    setHardware={setHardware}
                    setExtPowerCtrl={setExtPowerCtrl}
                    setBacklightPwm={setBacklightPwm}
                    setWs2812={setWs2812}
                />
            )}

            {showQmkCtrl && (
                <QmkConfigSection
                    config={config}
                    fc={fc}
                    targets={targets}
                    setFirmwareConfig={setFirmwareConfig}
                />
            )}

            <ReadinessSection config={config} />
        </div>
    )
}
