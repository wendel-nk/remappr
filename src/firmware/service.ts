import type {
    ActionType,
    AdapterNotification,
    AltRepeatKeyEntry,
    ComboEntry,
    DeviceInfo,
    DynamicEntryCounts,
    ExportedFile,
    KeyAction,
    KeyOverrideEntry,
    KeyUpdate,
    Keymap,
    Layer,
    LockState,
    TapDanceEntry,
} from './types'

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
}

export interface KeyboardService {
    readonly deviceInfo: DeviceInfo
    readonly capabilities: Capabilities

    getLockState(): Promise<LockState>
    unlock(): Promise<void>
    onLockStateChanged(cb: (state: LockState) => void): () => void

    listActionTypes(): Promise<ActionType[]>
    buildKeyAction(kind: string, params: number[]): KeyAction
    getKeymap(): Promise<Keymap>
    getPhysicalLayouts(): Promise<{
        layouts: import('./types').PhysicalLayout[]
        activeLayoutId: number
    }>

    setKey(layerId: number, position: number, action: KeyAction): Promise<void>
    setKeys(updates: KeyUpdate[]): Promise<void>
    // Optional — present only on firmware that exposes encoders (capabilities.encoders > 0).
    setEncoder?(
        layerId: number,
        encoderIdx: number,
        direction: 0 | 1,
        action: KeyAction,
    ): Promise<void>

    // Optional dynamic entries (Vial). Adapters without dynamic entries omit these.
    getDynamicEntryCounts?(): DynamicEntryCounts
    getTapDance?(idx: number): Promise<TapDanceEntry>
    setTapDance?(idx: number, entry: TapDanceEntry): Promise<void>
    getCombo?(idx: number): Promise<ComboEntry>
    setCombo?(idx: number, entry: ComboEntry): Promise<void>
    getKeyOverride?(idx: number): Promise<KeyOverrideEntry>
    setKeyOverride?(idx: number, entry: KeyOverrideEntry): Promise<void>
    getAltRepeatKey?(idx: number): Promise<AltRepeatKeyEntry>
    setAltRepeatKey?(idx: number, entry: AltRepeatKeyEntry): Promise<void>

    addLayer(): Promise<Layer>
    removeLayer(layerId: number): Promise<void>
    renameLayer(layerId: number, name: string): Promise<void>
    moveLayer(startIndex: number, destIndex: number): Promise<void>
    restoreLayer(layerId: number, atIndex: number): Promise<Layer>

    setActivePhysicalLayout(layoutId: number): Promise<Keymap>

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
