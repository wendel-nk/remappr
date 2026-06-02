import type { KeyCatalog } from './catalog/types'
import type { KeycodeCodec } from './codec'
import type { LightingCatalog } from './lighting'
import type {
    ActionType,
    AdapterNotification,
    AltRepeatKeyEntry,
    ComboEntry,
    DeviceInfo,
    DynamicEntryCounts,
    ExportedFile,
    KeyAction,
    Keymap,
    KeyOverrideEntry,
    KeyUpdate,
    Layer,
    LockState,
    MacroAction,
    TapDanceEntry,
} from './types'

// pattern-check: skip optional behavior-flags field added to existing Capabilities DTO — feature gate per firmware
export interface FirmwareBehaviorFlags {
    capsWord?: boolean
    leader?: boolean
    autoShift?: boolean
    swapHands?: boolean
}

export interface Capabilities {
    lock: boolean
    rename: boolean
    notifications: boolean
    reorderLayers: boolean
    variableLayerCount: boolean
    exportFormats: string[]
    maxLayers?: number
    encoders?: number
    dynamicEntries?: { tapDance: number; combo: number; keyOverride: number }
    macros?: { count: number; bufferSize: number }
    behaviors?: FirmwareBehaviorFlags
    layoutSideloadable?: boolean
}

// Pattern check: Facade (Tier 1) — applied — group related optional methods into 3 cohesive feature facades for renderer single-guard reads
export interface EncoderApi {
    setEncoder(
        layerId: number,
        encoderIdx: number,
        direction: 0 | 1,
        action: KeyAction,
    ): Promise<void>
}

export interface DynamicEntriesApi {
    getCounts(): DynamicEntryCounts

    getTapDance(idx: number): Promise<TapDanceEntry>

    setTapDance(idx: number, entry: TapDanceEntry): Promise<void>

    getCombo(idx: number): Promise<ComboEntry>

    setCombo(idx: number, entry: ComboEntry): Promise<void>

    getKeyOverride(idx: number): Promise<KeyOverrideEntry>

    setKeyOverride(idx: number, entry: KeyOverrideEntry): Promise<void>

    getAltRepeatKey?(idx: number): Promise<AltRepeatKeyEntry>

    setAltRepeatKey?(idx: number, entry: AltRepeatKeyEntry): Promise<void>
}

export interface MacroApi {
    getCount(): number

    getMacro(idx: number): Promise<MacroAction[]>

    setMacro(idx: number, actions: MacroAction[]): Promise<void>
}

// Pattern check: Facade (Tier 1) — applied — Keychron-style wireless surface (BT/2.4G/battery/LPM) grouped behind one optional service member; renderer reads service.wireless once instead of N capability flags.
export type WirelessTransport = 'usb' | 'bt' | 'p24g'

export interface WirelessLpm {
    enabled: boolean
    timeoutMs: number
}

export interface WirelessStatus {
    transport: WirelessTransport
    btSlot?: 1 | 2 | 3
    battery?: { level: number; charging: boolean }
}

export interface WirelessApi {
    getLpm(): Promise<WirelessLpm>

    setLpm(opts: WirelessLpm): Promise<void>

    getStatus(): Promise<WirelessStatus>

    onStatusChanged(cb: (status: WirelessStatus) => void): () => void

    getNkro?(): Promise<boolean>

    setNkro?(enabled: boolean): Promise<void>

    factoryReset?(): Promise<void>

    getModuleInfo?(): Promise<WirelessModuleInfo>
}

// pattern-check: skip — plain DTO for wireless-module firmware label
export interface WirelessModuleInfo {
    label: string
    moduleType: number
    versionMajor: number
    versionMinor: number
    versionPatch: number
}

// Pattern check: Facade (Tier 1) — applied — Keychron RGB surface (LED count, indicators, save) grouped behind one optional service member.
export interface IndicatorConfig {
    raw: Uint8Array
}

export interface HsvColor {
    h: number
    s: number
    v: number
}

// pattern-check: skip — data contract field additions, no abstraction
// Global backlight (RGB-matrix) effect state. `mode` indexes into RgbApi.effectNames.
export interface RgbEffectState {
    mode: number
    brightness: number // 0..255
    speed: number // 0..255
    color: HsvColor
}

export interface RgbApi {
    getLedCount(): Promise<number>

    getIndicators(): Promise<IndicatorConfig>

    setIndicators(cfg: IndicatorConfig): Promise<void>

    save(): Promise<void>

    // Backlight effect mode. Presence of effectCatalog + get/setEffect enables the
    // "Backlight" tab; firmware that can't drive a global effect omits them.
    effectCatalog?: LightingCatalog

    getEffect?(): Promise<RgbEffectState>

    setEffect?(state: RgbEffectState): Promise<void>

    getPerKeyType?(): Promise<number>

    setPerKeyType?(type: number): Promise<void>

    getPerKeyColors?(startLed: number, count: number): Promise<HsvColor[]>

    setPerKeyColors?(startLed: number, colors: HsvColor[]): Promise<void>

    getMixedRegions?(): Promise<Uint8Array>

    setMixedRegions?(payload: Uint8Array): Promise<void>

    getMixedEffect?(): Promise<Uint8Array>

    setMixedEffect?(payload: Uint8Array): Promise<void>
}

export interface KeyboardService {
    readonly deviceInfo: DeviceInfo
    readonly capabilities: Capabilities

    getLockState(): Promise<LockState>

    unlock(): Promise<void>

    onLockStateChanged(cb: (state: LockState) => void): () => void

    listActionTypes(): Promise<ActionType[]>

    buildKeyAction(kind: string, params: number[]): KeyAction

    /** Unified canonical catalog filtered by codec.supports(). PR 1 optional;
     *  promoted to required after every adapter ships a codec (PR 2). */
    listKeyCatalog?(): Promise<KeyCatalog>

    /** Strategy reference. Adapters expose codec for cross-firmware encode/decode. */
    codec?: KeycodeCodec

    getKeymap(): Promise<Keymap>

    getPhysicalLayouts(): Promise<{
        layouts: import('./types').PhysicalLayout[]
        activeLayoutId: number
    }>

    setKey(layerId: number, position: number, action: KeyAction): Promise<void>

    setKeys(updates: KeyUpdate[]): Promise<void>

    encoders?: EncoderApi
    dynamic?: DynamicEntriesApi
    macros?: MacroApi
    wireless?: WirelessApi
    rgb?: RgbApi

    addLayer(): Promise<Layer>

    removeLayer(layerId: number): Promise<void>

    renameLayer(layerId: number, name: string): Promise<void>

    moveLayer(startIndex: number, destIndex: number): Promise<void>

    restoreLayer(layerId: number, atIndex: number): Promise<Layer>

    setActivePhysicalLayout(layoutId: number): Promise<Keymap>

    /** Optional: swap to a sideloaded/registry-fetched VIA-style keyboard def.
     *  Throws on matrix-mismatch or pendingChanges. Adapters that don't expose
     *  this capability omit it. */
    applyLayout?(def: import('./kle/parser').ParsedKeyboardDef): Promise<void>

    commit(): Promise<void>

    discardChanges(): Promise<void>

    resetSettings(): Promise<void>

    hasPendingChanges(): boolean

    refreshPendingChanges(): Promise<boolean>

    onPendingChangesChanged(cb: (pending: boolean) => void): () => void

    subscribe(cb: (notification: AdapterNotification) => void): () => void

    exportConfig(): Promise<ExportedFile[]>

    onClosed(cb: (reason?: unknown) => void): () => void

    disconnect(): Promise<void>
}
