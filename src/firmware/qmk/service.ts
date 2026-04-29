/* eslint-disable @typescript-eslint/no-unused-vars */
// Pattern check: Adapter (Tier 1) — extended — extends src/firmware/qmk/service.ts QmkKeyboardService; HidClient-backed VIA implementation of the neutral KeyboardService facade.
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

import {
    QMK_KIND,
    buildQmkKeyAction,
    decodeAsKeyAction,
    encodeKeycode,
    relabelQmkLayer,
} from './actions'
import { QMK_ACTION_TYPES } from './actionTypes'
import { exportKeymap } from './export'
import type { HidClient } from './hidClient'
import {
    getKeycodeCmd,
    getLayerCountCmd,
    parseKeycode,
    parseLayerCount,
    parseSetKeycodeEcho,
    resetKeymapCmd,
    setKeycodeCmd,
} from './protocol'

const QMK_CAPABILITIES_BASE: Omit<Capabilities, 'maxLayers'> = {
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

export interface QmkServiceConfig {
    deviceInfo: DeviceInfo
    client: HidClient
    rows: number
    cols: number
    layerCount: number
    layerNames?: string[]
}

function makeGridLayout(rows: number, cols: number): PhysicalLayout {
    const keys = []
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            keys.push({ x: c, y: r, w: 1, h: 1 })
        }
    }
    return { id: 0, name: 'Default', keys }
}

export async function readQmkLayerCount(client: HidClient): Promise<number> {
    const resp = await client.send(getLayerCountCmd())
    const n = parseLayerCount(resp)
    if (n <= 0 || n > 32) {
        throw new ProtocolError(`QMK reported invalid layer count: ${n}`)
    }
    return n
}

async function readLayerKeycodes(
    client: HidClient,
    layer: number,
    rows: number,
    cols: number,
): Promise<KeyAction[]> {
    const out: KeyAction[] = []
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const resp = await client.send(getKeycodeCmd(layer, r, c))
            const { keycode } = parseKeycode(resp)
            out.push(decodeAsKeyAction(keycode))
        }
    }
    return out
}

export async function loadInitialKeymap(
    client: HidClient,
    rows: number,
    cols: number,
    layerCount: number,
): Promise<Layer[]> {
    const layers: Layer[] = []
    for (let i = 0; i < layerCount; i++) {
        const keys = await readLayerKeycodes(client, i, rows, cols)
        layers.push({ id: i, name: `Layer ${i}`, keys })
    }
    return layers
}

export class QmkKeyboardService implements KeyboardService {
    public readonly capabilities: Capabilities
    public readonly deviceInfo: DeviceInfo

    private readonly client: HidClient
    private readonly rows: number
    private readonly cols: number
    private readonly layout: PhysicalLayout
    private layers: Layer[]
    private layerNames: string[]
    private pendingChanges = false
    private closed = false

    private readonly notificationListeners = new Set<NotificationHandler>()
    private readonly pendingChangesListeners = new Set<PendingChangesHandler>()
    private readonly closedListeners = new Set<ClosedHandler>()

    private constructor(cfg: QmkServiceConfig, layers: Layer[]) {
        this.deviceInfo = cfg.deviceInfo
        this.client = cfg.client
        this.rows = cfg.rows
        this.cols = cfg.cols
        this.layers = layers
        this.layerNames = cfg.layerNames ?? layers.map((l) => l.name)
        this.layout = makeGridLayout(cfg.rows, cfg.cols)
        this.capabilities = {
            ...QMK_CAPABILITIES_BASE,
            maxLayers: cfg.layerCount,
        }
        cfg.client.onClosed((reason) => this.handleClientClosed(reason))
    }

    static async create(cfg: QmkServiceConfig): Promise<QmkKeyboardService> {
        const layers = await loadInitialKeymap(
            cfg.client,
            cfg.rows,
            cfg.cols,
            cfg.layerCount,
        )
        return new QmkKeyboardService(cfg, layers)
    }

    private handleClientClosed(reason?: unknown): void {
        if (this.closed) return
        this.closed = true
        for (const cb of this.closedListeners) {
            try {
                cb(reason)
            } catch {
                /* ignore */
            }
        }
    }

    private positionToCoord(position: number): { row: number; col: number } {
        const total = this.rows * this.cols
        if (position < 0 || position >= total) {
            throw new ProtocolError(
                `QMK position out of range: ${position} (max ${total - 1})`,
            )
        }
        return {
            row: Math.floor(position / this.cols),
            col: position % this.cols,
        }
    }

    private setPending(next: boolean): void {
        if (this.pendingChanges === next) return
        this.pendingChanges = next
        for (const cb of this.pendingChangesListeners) cb(next)
    }

    private layerIndexById(layerId: number): number {
        return this.layers.findIndex((l) => l.id === layerId)
    }

    async getLockState(): Promise<LockState> {
        return 'not-applicable'
    }

    async unlock(): Promise<void> {
        // VIA: no lock semantics.
    }

    onLockStateChanged(_cb: LockStateHandler): () => void {
        return () => undefined
    }

    async listActionTypes(): Promise<ActionType[]> {
        return QMK_ACTION_TYPES
    }

    buildKeyAction(kind: string, params: number[]): KeyAction {
        return buildQmkKeyAction(kind, params, this.layerNames)
    }

    async getKeymap(): Promise<Keymap> {
        return {
            layers: this.layers.map((l) => ({
                id: l.id,
                name: l.name,
                keys: relabelQmkLayer(l.keys, this.layerNames),
            })),
            availableLayers: 0,
            activeLayoutId: this.layout.id,
            layouts: [this.layout],
        }
    }

    async getPhysicalLayouts(): Promise<{
        layouts: PhysicalLayout[]
        activeLayoutId: number
    }> {
        return { layouts: [this.layout], activeLayoutId: this.layout.id }
    }

    async setKey(
        layerId: number,
        position: number,
        action: KeyAction,
    ): Promise<void> {
        if (this.closed) throw new UnsupportedError('setKey: connection closed')
        const idx = this.layerIndexById(layerId)
        if (idx < 0) throw new ProtocolError(`Unknown layer id: ${layerId}`)
        const { row, col } = this.positionToCoord(position)
        const kc = encodeKeycode(action)
        const resp = await this.client.send(setKeycodeCmd(idx, row, col, kc))
        const echo = parseSetKeycodeEcho(resp)
        if (
            echo.layer !== idx ||
            echo.row !== row ||
            echo.col !== col ||
            echo.keycode !== kc
        ) {
            throw new ProtocolError(
                `setKey echo mismatch: sent (${idx},${row},${col},0x${kc.toString(16)}) got (${echo.layer},${echo.row},${echo.col},0x${echo.keycode.toString(16)})`,
            )
        }
        const next = this.layers[idx].keys.slice()
        next[position] = buildQmkKeyAction(
            action.kind,
            action.params,
            this.layerNames,
        )
        this.layers[idx] = { ...this.layers[idx], keys: next }
        this.setPending(true)
    }

    async setKeys(updates: KeyUpdate[]): Promise<void> {
        for (const u of updates) {
            await this.setKey(u.layerId, u.position, u.action)
        }
    }

    async addLayer(): Promise<Layer> {
        throw new UnsupportedError(
            'addLayer: VIA layer count is fixed by firmware',
        )
    }

    async removeLayer(_layerId: number): Promise<void> {
        throw new UnsupportedError(
            'removeLayer: VIA layer count is fixed by firmware',
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
            'restoreLayer: VIA does not retain prior layers',
        )
    }

    async setActivePhysicalLayout(layoutId: number): Promise<Keymap> {
        if (layoutId !== this.layout.id) {
            throw new UnsupportedError(
                'setActivePhysicalLayout: VIA exposes a single fixed layout',
            )
        }
        return this.getKeymap()
    }

    async commit(): Promise<void> {
        // VIA writes immediately on setKey; commit() resets the UI's
        // pending-changes flag so the user can re-export from a stable state.
        this.setPending(false)
    }

    async discardChanges(): Promise<void> {
        throw new UnsupportedError(
            'discardChanges: VIA writes immediately — no pending buffer to discard',
        )
    }

    async resetSettings(): Promise<void> {
        await this.client.send(resetKeymapCmd())
        this.layers = await loadInitialKeymap(
            this.client,
            this.rows,
            this.cols,
            this.capabilities.maxLayers ?? this.layers.length,
        )
        this.setPending(false)
    }

    hasPendingChanges(): boolean {
        return this.pendingChanges
    }

    async refreshPendingChanges(): Promise<boolean> {
        return this.pendingChanges
    }

    onPendingChangesChanged(cb: PendingChangesHandler): () => void {
        this.pendingChangesListeners.add(cb)
        return () => this.pendingChangesListeners.delete(cb)
    }

    subscribe(cb: NotificationHandler): () => void {
        // VIA has no firmware-pushed notifications; expose the registration
        // surface so UI code is uniform with ZMK/mock adapters.
        this.notificationListeners.add(cb)
        return () => this.notificationListeners.delete(cb)
    }

    async exportConfig(): Promise<ExportedFile[]> {
        const km = await this.getKeymap()
        return exportKeymap(km, this.deviceInfo.name)
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
        await this.client.close()
        this.handleClientClosed('disconnect')
    }
}

// Helper exposed for the contract test + tests that need to bypass the
// async create() — useful when seeding a fake transport/keymap.
export function buildBasicAction(code: number): KeyAction {
    return buildQmkKeyAction(QMK_KIND.BASIC, [code])
}
