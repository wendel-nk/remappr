import type {
    ActionType,
    AdapterNotification,
    DeviceInfo,
    ExportedFile,
    KeyAction,
    KeyUpdate,
    Keymap,
    Layer,
    LockState,
} from './types'

export interface Capabilities {
    lock: boolean
    rename: boolean
    notifications: boolean
    reorderLayers: boolean
    variableLayerCount: boolean
    exportFormats: string[]
    maxLayers?: number
}

export interface KeyboardService {
    readonly deviceInfo: DeviceInfo
    readonly capabilities: Capabilities

    getLockState(): Promise<LockState>
    unlock(): Promise<void>
    onLockStateChanged(cb: (state: LockState) => void): () => void

    listActionTypes(): Promise<ActionType[]>
    getKeymap(): Promise<Keymap>
    getPhysicalLayouts(): Promise<{
        layouts: import('./types').PhysicalLayout[]
        activeLayoutId: number
    }>

    setKey(layerId: number, position: number, action: KeyAction): Promise<void>
    setKeys(updates: KeyUpdate[]): Promise<void>

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
