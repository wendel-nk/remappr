/* eslint-disable @typescript-eslint/no-unused-vars */
// Pattern check: Adapter (Tier 1) — applied — backs src/firmware/adapter.ts FirmwareAdapter; QMK/VIA-protocol KeyboardService stub maps the neutral facade onto a future VIA HID transport.
import type { Capabilities, KeyboardService } from '@firmware/service'
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
    PhysicalLayout,
} from '@firmware/types'
import { ProtocolError, UnsupportedError } from '@firmware/errors'
import { QMK_ACTION_TYPES } from './actionTypes'

const QMK_CAPABILITIES: Capabilities = {
    lock: false,
    rename: false,
    notifications: false,
    reorderLayers: false,
    variableLayerCount: false,
    exportFormats: ['keymap.c'],
}

type LockStateHandler = (state: LockState) => void
type PendingChangesHandler = (pending: boolean) => void
type NotificationHandler = (notification: AdapterNotification) => void
type ClosedHandler = (reason?: unknown) => void

function describeQmkValue(action: KeyAction, kind: string): string {
    if (kind === 'qmk:none') return 'None'
    if (kind === 'qmk:trans') return 'Trans'
    if (kind === 'qmk:basic') return `0x${(action.params[0] ?? 0).toString(16)}`
    if (kind === 'qmk:mod-tap')
        return `MT 0x${(action.params[0] ?? 0).toString(16)} / 0x${(action.params[1] ?? 0).toString(16)}`
    if (kind === 'qmk:layer-tap')
        return `LT ${action.params[0] ?? 0} / 0x${(action.params[1] ?? 0).toString(16)}`
    if (kind === 'qmk:momentary') return `MO ${action.params[0] ?? 0}`
    if (kind === 'qmk:toggle-layer') return `TG ${action.params[0] ?? 0}`
    return action.kind
}

export class QmkKeyboardService implements KeyboardService {
    public readonly capabilities: Capabilities = QMK_CAPABILITIES
    public readonly deviceInfo: DeviceInfo

    private cachedKeymap: Keymap | null = null
    private readonly closedListeners = new Set<ClosedHandler>()
    private closed = false

    constructor(deviceInfo: DeviceInfo) {
        this.deviceInfo = deviceInfo
    }

    async getLockState(): Promise<LockState> {
        return 'not-applicable'
    }

    async unlock(): Promise<void> {
        // VIA has no lock state.
    }

    onLockStateChanged(_cb: LockStateHandler): () => void {
        return () => undefined
    }

    async listActionTypes(): Promise<ActionType[]> {
        return QMK_ACTION_TYPES
    }

    buildKeyAction(kind: string, params: number[]): KeyAction {
        const action: KeyAction = {
            kind,
            params: [...params],
            label: { primary: '' },
        }
        const primary = describeQmkValue(action, kind)
        action.label = { primary, description: primary }
        return action
    }

    async getKeymap(): Promise<Keymap> {
        if (this.cachedKeymap) return this.cachedKeymap
        throw new UnsupportedError(
            'getKeymap: VIA HID transport not yet implemented',
        )
    }

    async getPhysicalLayouts(): Promise<{
        layouts: PhysicalLayout[]
        activeLayoutId: number
    }> {
        throw new UnsupportedError(
            'getPhysicalLayouts: VIA HID transport not yet implemented',
        )
    }

    async setKey(
        _layerId: number,
        _position: number,
        _action: KeyAction,
    ): Promise<void> {
        throw new UnsupportedError(
            'setKey: VIA HID transport not yet implemented',
        )
    }

    async setKeys(_updates: KeyUpdate[]): Promise<void> {
        throw new UnsupportedError(
            'setKeys: VIA HID transport not yet implemented',
        )
    }

    async addLayer(): Promise<Layer> {
        throw new UnsupportedError('addLayer: VIA does not support add layer')
    }

    async removeLayer(_layerId: number): Promise<void> {
        throw new UnsupportedError(
            'removeLayer: VIA does not support remove layer',
        )
    }

    async renameLayer(_layerId: number, _name: string): Promise<void> {
        throw new UnsupportedError('renameLayer: VIA does not support rename')
    }

    async moveLayer(_startIndex: number, _destIndex: number): Promise<void> {
        throw new UnsupportedError('moveLayer: VIA does not support reordering')
    }

    async restoreLayer(_layerId: number, _atIndex: number): Promise<Layer> {
        throw new UnsupportedError(
            'restoreLayer: VIA does not support restore layer',
        )
    }

    async setActivePhysicalLayout(_layoutId: number): Promise<Keymap> {
        throw new UnsupportedError(
            'setActivePhysicalLayout: VIA HID transport not yet implemented',
        )
    }

    async commit(): Promise<void> {
        // VIA writes immediately; commit is a no-op.
    }

    async discardChanges(): Promise<void> {
        throw new UnsupportedError(
            'discardChanges: VIA writes immediately, no pending changes to discard',
        )
    }

    async resetSettings(): Promise<void> {
        throw new UnsupportedError(
            'resetSettings: VIA HID transport not yet implemented',
        )
    }

    hasPendingChanges(): boolean {
        return false
    }

    async refreshPendingChanges(): Promise<boolean> {
        return false
    }

    onPendingChangesChanged(_cb: PendingChangesHandler): () => void {
        return () => undefined
    }

    subscribe(_cb: NotificationHandler): () => void {
        return () => undefined
    }

    async exportConfig(): Promise<ExportedFile[]> {
        throw new UnsupportedError(
            'exportConfig: VIA keymap.c emitter not yet implemented',
        )
    }

    onClosed(cb: ClosedHandler): () => void {
        if (this.closed) {
            cb()
            return () => undefined
        }
        this.closedListeners.add(cb)
        return () => this.closedListeners.delete(cb)
    }

    async disconnect(): Promise<void> {
        if (this.closed) return
        this.closed = true
        for (const cb of this.closedListeners) cb()
    }

    /** Reserved for the future VIA HID transport: pre-populate cached keymap. */
    seedKeymap(km: Keymap): void {
        if (km.layers.length === 0) {
            throw new ProtocolError('Cannot seed empty QMK keymap')
        }
        this.cachedKeymap = km
    }
}
