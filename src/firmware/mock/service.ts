// Pattern check: Adapter (Tier 1) — extended — backs src/firmware/service.ts KeyboardService Facade; in-memory keyboard implementation for dev/storybook/tests, mirrors ZmkKeyboardService surface.
// pattern-check: skip — wire encoders/dynamic/macros sub-bundles defined in service.ts
import { filterCatalogByCodec } from '@firmware/catalog/filter'
import type { KeyCatalog } from '@firmware/catalog/types'
import type {
    Capabilities,
    DynamicEntriesApi,
    EncoderApi,
    HsvColor,
    KeyboardService,
    MacroApi,
    RgbApi,
} from '@firmware/service'
import type {
    ActionType,
    AdapterNotification,
    AltRepeatKeyEntry,
    ComboEntry,
    DeviceInfo,
    DynamicEntryCounts,
    EncoderAction,
    ExportedFile,
    KeyAction,
    Keymap,
    KeyOverrideEntry,
    KeyUpdate,
    Layer,
    LockState,
    MacroAction,
    PhysicalLayout,
    TapDanceEntry,
} from '@firmware/types'
import { LockedError, ProtocolError } from '@firmware/errors'

import {
    buildMockActionTypes,
    buildMockKeyAction,
    HID_KP,
    MOCK_KIND_KEYPRESS,
    MOCK_KIND_TRANSPARENT,
    relabelLayer,
} from './actions'
import { mockCodec } from './codec'
import { MOCK_CORNE_LAYOUT, MOCK_KEY_COUNT, MOCK_LAYOUTS } from './layout'

const MOCK_DYNAMIC_COUNTS: DynamicEntryCounts = {
    tapDance: 4,
    combo: 4,
    keyOverride: 4,
}

const MOCK_MACRO_COUNT = 3
const MOCK_MACRO_BUFFER = 256
const MOCK_ENCODER_COUNT = 2
const MOCK_LED_COUNT = 24

const MOCK_CAPABILITIES: Capabilities = {
    lock: true,
    rename: true,
    notifications: true,
    reorderLayers: true,
    variableLayerCount: true,
    exportFormats: ['mock-json'],
    maxLayers: 8,
    encoders: MOCK_ENCODER_COUNT,
    dynamicEntries: MOCK_DYNAMIC_COUNTS,
    macros: { count: MOCK_MACRO_COUNT, bufferSize: MOCK_MACRO_BUFFER },
    behaviors: {
        capsWord: true,
        leader: true,
        autoShift: true,
        swapHands: true,
    },
}

const ZERO_TAP_DANCE: TapDanceEntry = {
    onTap: 0,
    onHold: 0,
    onDoubleTap: 0,
    onTapHold: 0,
    tappingTerm: 200,
}

const ZERO_COMBO: ComboEntry = { keys: [0, 0, 0, 0], output: 0 }

const ZERO_KEY_OVERRIDE: KeyOverrideEntry = {
    trigger: 0,
    replacement: 0,
    layers: 0xffff,
    triggerMods: 0,
    negativeModMask: 0,
    suppressedMods: 0,
    options: {
        activationTriggerDown: false,
        activationRequiredModDown: false,
        activationNegativeModUp: false,
        oneMod: false,
        noReregisterTrigger: false,
        noUnregisterOnOtherKeyDown: false,
        enabled: false,
    },
}

const ZERO_ARK: AltRepeatKeyEntry = {
    keycode: 0,
    altKeycode: 0,
    allowedMods: 0,
    options: {
        defaultToThisAltKey: false,
        bidirectional: false,
        ignoreModHandedness: false,
        enabled: false,
    },
}

type NotificationHandler = (notification: AdapterNotification) => void
type LockStateHandler = (state: LockState) => void
type PendingChangesHandler = (pending: boolean) => void
type ClosedHandler = (reason?: unknown) => void

interface MockServiceOptions {
    deviceInfo?: Partial<DeviceInfo>
    initiallyLocked?: boolean
}

export class MockKeyboardService implements KeyboardService {
    public readonly capabilities: Capabilities = MOCK_CAPABILITIES
    public readonly deviceInfo: DeviceInfo
    public readonly codec = mockCodec
    public readonly encoders: EncoderApi
    public readonly dynamic: DynamicEntriesApi
    public readonly macros: MacroApi
    public readonly rgb: RgbApi

    private tapDances: TapDanceEntry[] = Array.from(
        { length: MOCK_DYNAMIC_COUNTS.tapDance },
        () => ({ ...ZERO_TAP_DANCE }),
    )
    private combos: ComboEntry[] = Array.from(
        { length: MOCK_DYNAMIC_COUNTS.combo },
        () => ({ ...ZERO_COMBO, keys: [0, 0, 0, 0] as ComboEntry['keys'] }),
    )
    private keyOverrides: KeyOverrideEntry[] = Array.from(
        { length: MOCK_DYNAMIC_COUNTS.keyOverride },
        () => ({
            ...ZERO_KEY_OVERRIDE,
            options: { ...ZERO_KEY_OVERRIDE.options },
        }),
    )
    private altRepeatKeys: AltRepeatKeyEntry[] = Array.from(
        { length: 4 },
        () => ({ ...ZERO_ARK, options: { ...ZERO_ARK.options } }),
    )
    private macroBuffers: MacroAction[][] = Array.from(
        { length: MOCK_MACRO_COUNT },
        () => [] as MacroAction[],
    )

    private layers: Layer[] = []
    private layouts: PhysicalLayout[] = MOCK_LAYOUTS.map((l) => ({ ...l }))
    private activeLayoutId = 0
    private lockState: LockState
    private pendingChanges = false
    private closed = false

    private readonly notificationListeners = new Set<NotificationHandler>()
    private readonly lockStateListeners = new Set<LockStateHandler>()
    private readonly pendingChangesListeners = new Set<PendingChangesHandler>()
    private readonly closedListeners = new Set<ClosedHandler>()

    private nextLayerId = 0

    private perKeyColors: HsvColor[] = Array.from(
        { length: MOCK_LED_COUNT },
        (_, i) => ({
            h: Math.round(((i * 255) / MOCK_LED_COUNT) % 256),
            s: 220,
            v: 200,
        }),
    )
    private perKeyType: number = 0
    private indicatorsRaw: Uint8Array = new Uint8Array([
        0x01, 0x00, 0xff, 0x80, 0x80,
    ])
    private mixedRegions: Uint8Array = new Uint8Array([0x01, 0x02, 0x03, 0x04])
    private mixedEffect: Uint8Array = new Uint8Array([0x05, 0x06, 0x07, 0x08])

    constructor(opts: MockServiceOptions = {}) {
        this.deviceInfo = {
            name: opts.deviceInfo?.name ?? 'Mock Corne',
            firmware: 'mock',
            firmwareVersion: opts.deviceInfo?.firmwareVersion ?? '0.0.0',
            serialNumber: opts.deviceInfo?.serialNumber ?? 'MOCK-0001',
        }
        this.lockState = opts.initiallyLocked ? 'locked' : 'unlocked'
        this.seedDefaultLayers()
        // pattern-check: skip — inline closures over private state for sub-bundle stubs
        this.encoders = {
            setEncoder: async (layerId, encoderIdx, direction, action) => {
                this.requireUnlocked()
                const li = this.layerIndexById(layerId)
                if (li < 0)
                    throw new ProtocolError(`Unknown layer id: ${layerId}`)
                if (encoderIdx < 0 || encoderIdx >= MOCK_ENCODER_COUNT) {
                    throw new ProtocolError(
                        `Encoder index out of range: ${encoderIdx}`,
                    )
                }
                const layer = this.layers[li]
                const encs = (layer.encoders ?? this.defaultEncoders()).slice()
                const cur = encs[encoderIdx]
                encs[encoderIdx] =
                    direction === 0
                        ? { cw: action, ccw: cur.ccw }
                        : { cw: cur.cw, ccw: action }
                this.layers[li] = { ...layer, encoders: encs }
                this.markPending(true)
            },
        }
        this.dynamic = {
            getCounts: () => ({ ...MOCK_DYNAMIC_COUNTS }),
            getTapDance: async (idx) => ({ ...this.requireTapDance(idx) }),
            setTapDance: async (idx, entry) => {
                this.requireUnlocked()
                this.requireTapDance(idx)
                this.tapDances[idx] = { ...entry }
                this.markPending(true)
            },
            getCombo: async (idx) => {
                const c = this.requireCombo(idx)
                return { ...c, keys: [...c.keys] as ComboEntry['keys'] }
            },
            setCombo: async (idx, entry) => {
                this.requireUnlocked()
                this.requireCombo(idx)
                this.combos[idx] = {
                    ...entry,
                    keys: [...entry.keys] as ComboEntry['keys'],
                }
                this.markPending(true)
            },
            getKeyOverride: async (idx) => {
                const k = this.requireKeyOverride(idx)
                return { ...k, options: { ...k.options } }
            },
            setKeyOverride: async (idx, entry) => {
                this.requireUnlocked()
                this.requireKeyOverride(idx)
                this.keyOverrides[idx] = {
                    ...entry,
                    options: { ...entry.options },
                }
                this.markPending(true)
            },
            getAltRepeatKey: async (idx) => {
                const a = this.requireAltRepeatKey(idx)
                return { ...a, options: { ...a.options } }
            },
            setAltRepeatKey: async (idx, entry) => {
                this.requireUnlocked()
                this.requireAltRepeatKey(idx)
                this.altRepeatKeys[idx] = {
                    ...entry,
                    options: { ...entry.options },
                }
                this.markPending(true)
            },
        }
        this.macros = {
            getCount: () => MOCK_MACRO_COUNT,
            getMacro: async (idx) => {
                this.requireMacro(idx)
                return this.macroBuffers[idx].map((a) => ({ ...a }))
            },
            setMacro: async (idx, actions) => {
                this.requireUnlocked()
                this.requireMacro(idx)
                this.macroBuffers[idx] = actions.map((a) => ({ ...a }))
                this.markPending(true)
            },
        }
        this.rgb = {
            getLedCount: async () => MOCK_LED_COUNT,
            getIndicators: async () => ({ raw: this.indicatorsRaw.slice() }),
            setIndicators: async (cfg) => {
                this.indicatorsRaw = cfg.raw.slice()
                this.markPending(true)
            },
            save: async () => {
                /* in-memory mock has no persistence */
            },
            getPerKeyType: async () => this.perKeyType,
            setPerKeyType: async (t) => {
                this.perKeyType = t & 0xff
                this.markPending(true)
            },
            getPerKeyColors: async (start, count) => {
                if (start < 0 || start + count > this.perKeyColors.length) {
                    throw new ProtocolError(
                        `Per-key range out of bounds: start=${start} count=${count}`,
                    )
                }
                return this.perKeyColors
                    .slice(start, start + count)
                    .map((c) => ({ ...c }))
            },
            setPerKeyColors: async (start, colors) => {
                if (
                    start < 0 ||
                    start + colors.length > this.perKeyColors.length
                ) {
                    throw new ProtocolError(
                        `Per-key range out of bounds: start=${start} count=${colors.length}`,
                    )
                }
                for (let i = 0; i < colors.length; i++) {
                    this.perKeyColors[start + i] = { ...colors[i] }
                }
                this.markPending(true)
            },
            getMixedRegions: async () => this.mixedRegions.slice(),
            setMixedRegions: async (b) => {
                this.mixedRegions = b.slice()
                this.markPending(true)
            },
            getMixedEffect: async () => this.mixedEffect.slice(),
            setMixedEffect: async (b) => {
                this.mixedEffect = b.slice()
                this.markPending(true)
            },
        }
    }

    private defaultEncoders(): EncoderAction[] {
        const xparent: KeyAction = buildMockKeyAction(
            MOCK_KIND_TRANSPARENT,
            [],
            this.layerNames(),
        )
        return Array.from({ length: MOCK_ENCODER_COUNT }, () => ({
            cw: xparent,
            ccw: xparent,
        }))
    }

    private requireTapDance(idx: number): TapDanceEntry {
        if (idx < 0 || idx >= this.tapDances.length) {
            throw new ProtocolError(`Tap-dance index out of range: ${idx}`)
        }
        return this.tapDances[idx]
    }

    private requireCombo(idx: number): ComboEntry {
        if (idx < 0 || idx >= this.combos.length) {
            throw new ProtocolError(`Combo index out of range: ${idx}`)
        }
        return this.combos[idx]
    }

    private requireKeyOverride(idx: number): KeyOverrideEntry {
        if (idx < 0 || idx >= this.keyOverrides.length) {
            throw new ProtocolError(`Key-override index out of range: ${idx}`)
        }
        return this.keyOverrides[idx]
    }

    private requireAltRepeatKey(idx: number): AltRepeatKeyEntry {
        if (idx < 0 || idx >= this.altRepeatKeys.length) {
            throw new ProtocolError(`Alt-repeat-key index out of range: ${idx}`)
        }
        return this.altRepeatKeys[idx]
    }

    private requireMacro(idx: number): void {
        if (idx < 0 || idx >= this.macroBuffers.length) {
            throw new ProtocolError(`Macro index out of range: ${idx}`)
        }
    }

    private seedDefaultLayers(): void {
        const baseKeys = this.makeQwertyBase()
        const lowerKeys = this.makeFiller(MOCK_KIND_TRANSPARENT)
        this.layers = [
            { id: this.nextLayerId++, name: 'Base', keys: baseKeys },
            { id: this.nextLayerId++, name: 'Lower', keys: lowerKeys },
        ]
    }

    private layerNames(): string[] {
        return this.layers.map((l) => l.name)
    }

    private makeFiller(kind: string, params: number[] = []): KeyAction[] {
        return Array.from({ length: MOCK_KEY_COUNT }, () =>
            buildMockKeyAction(kind, params, this.layerNames()),
        )
    }

    private makeQwertyBase(): KeyAction[] {
        // Top row: q w e r t  y u i o p
        // Home    : a s d f g  h j k l ;
        // Bottom  : z x c v b  n m , . /
        // Thumbs : esc spc tab  enter bspc del (mock)
        const left = [
            'Q',
            'W',
            'E',
            'R',
            'T',
            'A',
            'S',
            'D',
            'F',
            'G',
            'Z',
            'X',
            'C',
            'V',
            'B',
        ]
        const right = [
            'Y',
            'U',
            'I',
            'O',
            'P',
            'H',
            'J',
            'K',
            'L',
            ';',
            'N',
            'M',
            ',',
            '.',
            '/',
        ]
        // HID usage codes (encoded as page<<16|id to match renderer + picker)
        const hidFor = (ch: string): number => {
            if (ch >= 'A' && ch <= 'Z')
                return HID_KP(0x04 + (ch.charCodeAt(0) - 65))
            if (ch === ';') return HID_KP(0x33)
            if (ch === ',') return HID_KP(0x36)
            if (ch === '.') return HID_KP(0x37)
            if (ch === '/') return HID_KP(0x38)
            return 0x00
        }
        const thumbs = [
            HID_KP(0x29), // Esc
            HID_KP(0x2c), // Space
            HID_KP(0x2b), // Tab
            HID_KP(0x28), // Enter
            HID_KP(0x2a), // Backspace
            HID_KP(0x4c), // Delete
        ]
        const codes: number[] = [
            ...left.map(hidFor),
            ...thumbs.slice(0, 3),
            ...right.map(hidFor),
            ...thumbs.slice(3),
        ]
        if (codes.length !== MOCK_KEY_COUNT) {
            throw new ProtocolError(
                `Mock base layer key count mismatch: ${codes.length} vs ${MOCK_KEY_COUNT}`,
            )
        }
        return codes.map((c) =>
            buildMockKeyAction(
                c === 0 ? MOCK_KIND_TRANSPARENT : MOCK_KIND_KEYPRESS,
                c === 0 ? [] : [c],
                this.layerNames(),
            ),
        )
    }

    private requireUnlocked(): void {
        if (this.lockState !== 'unlocked') {
            throw new LockedError()
        }
    }

    private markPending(pending: boolean): void {
        if (this.pendingChanges === pending) return
        this.pendingChanges = pending
        for (const cb of this.pendingChangesListeners) cb(pending)
    }

    private setLockState(next: LockState): void {
        if (this.lockState === next) return
        this.lockState = next
        for (const cb of this.lockStateListeners) cb(next)
    }

    private emitNotification(topic: string, payload: unknown): void {
        for (const cb of this.notificationListeners) cb({ topic, payload })
    }

    async getLockState(): Promise<LockState> {
        return this.lockState
    }

    async unlock(): Promise<void> {
        if (this.lockState === 'unlocked') return
        this.setLockState('unlocking')
        // Mock: instant unlock; real device would wait for user.
        this.setLockState('unlocked')
    }

    onLockStateChanged(cb: LockStateHandler): () => void {
        this.lockStateListeners.add(cb)
        return () => this.lockStateListeners.delete(cb)
    }

    async listActionTypes(): Promise<ActionType[]> {
        return buildMockActionTypes(this.capabilities.maxLayers ?? 8)
    }

    buildKeyAction(kind: string, params: number[]): KeyAction {
        return buildMockKeyAction(kind, params, this.layerNames())
    }

    async listKeyCatalog(): Promise<KeyCatalog> {
        return filterCatalogByCodec(this.codec)
    }

    async getKeymap(): Promise<Keymap> {
        return {
            layers: this.layers.map((l) => ({
                id: l.id,
                name: l.name,
                keys: relabelLayer(l.keys, this.layerNames()),
            })),
            availableLayers:
                (this.capabilities.maxLayers ?? 8) - this.layers.length,
            activeLayoutId: this.activeLayoutId,
            layouts: this.layouts.map((l) => ({ ...l })),
        }
    }

    async getPhysicalLayouts(): Promise<{
        layouts: PhysicalLayout[]
        activeLayoutId: number
    }> {
        return {
            layouts: this.layouts.map((l) => ({ ...l })),
            activeLayoutId: this.activeLayoutId,
        }
    }

    private layerIndexById(layerId: number): number {
        return this.layers.findIndex((l) => l.id === layerId)
    }

    async setKey(
        layerId: number,
        position: number,
        action: KeyAction,
    ): Promise<void> {
        this.requireUnlocked()
        const idx = this.layerIndexById(layerId)
        if (idx < 0) throw new ProtocolError(`Unknown layer id: ${layerId}`)
        if (position < 0 || position >= MOCK_KEY_COUNT) {
            throw new ProtocolError(`Position out of range: ${position}`)
        }
        const layer = this.layers[idx]
        const next = layer.keys.slice()
        next[position] = buildMockKeyAction(
            action.kind,
            action.params,
            this.layerNames(),
        )
        this.layers[idx] = { ...layer, keys: next }
        this.markPending(true)
    }

    async setKeys(updates: KeyUpdate[]): Promise<void> {
        for (const u of updates) {
            await this.setKey(u.layerId, u.position, u.action)
        }
    }

    async addLayer(): Promise<Layer> {
        this.requireUnlocked()
        const max = this.capabilities.maxLayers ?? 8
        if (this.layers.length >= max) {
            throw new ProtocolError('Max layers reached')
        }
        const layer: Layer = {
            id: this.nextLayerId++,
            name: `Layer ${this.layers.length}`,
            keys: this.makeFiller(MOCK_KIND_TRANSPARENT),
        }
        this.layers.push(layer)
        this.markPending(true)
        return { ...layer, keys: relabelLayer(layer.keys, this.layerNames()) }
    }

    async removeLayer(layerId: number): Promise<void> {
        this.requireUnlocked()
        const idx = this.layerIndexById(layerId)
        if (idx < 0) throw new ProtocolError(`Unknown layer id: ${layerId}`)
        if (this.layers.length <= 1) {
            throw new ProtocolError('Cannot remove the only layer')
        }
        this.layers.splice(idx, 1)
        this.markPending(true)
    }

    async renameLayer(layerId: number, name: string): Promise<void> {
        this.requireUnlocked()
        const idx = this.layerIndexById(layerId)
        if (idx < 0) throw new ProtocolError(`Unknown layer id: ${layerId}`)
        this.layers[idx] = { ...this.layers[idx], name }
        this.markPending(true)
    }

    async moveLayer(startIndex: number, destIndex: number): Promise<void> {
        this.requireUnlocked()
        if (
            startIndex < 0 ||
            startIndex >= this.layers.length ||
            destIndex < 0 ||
            destIndex >= this.layers.length
        ) {
            throw new ProtocolError(
                `moveLayer indices out of range: ${startIndex} -> ${destIndex}`,
            )
        }
        const [moved] = this.layers.splice(startIndex, 1)
        this.layers.splice(destIndex, 0, moved)
        this.markPending(true)
    }

    async restoreLayer(layerId: number, atIndex: number): Promise<Layer> {
        this.requireUnlocked()
        const layer: Layer = {
            id: layerId,
            name: `Restored ${layerId}`,
            keys: this.makeFiller(MOCK_KIND_TRANSPARENT),
        }
        const clamped = Math.max(0, Math.min(atIndex, this.layers.length))
        this.layers.splice(clamped, 0, layer)
        this.nextLayerId = Math.max(this.nextLayerId, layerId + 1)
        this.markPending(true)
        return { ...layer, keys: relabelLayer(layer.keys, this.layerNames()) }
    }

    async setActivePhysicalLayout(layoutId: number): Promise<Keymap> {
        this.requireUnlocked()
        if (!this.layouts.some((l) => l.id === layoutId)) {
            throw new ProtocolError(`Unknown layout id: ${layoutId}`)
        }
        this.activeLayoutId = layoutId
        return this.getKeymap()
    }

    async commit(): Promise<void> {
        this.requireUnlocked()
        this.markPending(false)
    }

    async discardChanges(): Promise<void> {
        this.requireUnlocked()
        this.seedDefaultLayers()
        this.markPending(false)
    }

    async resetSettings(): Promise<void> {
        this.requireUnlocked()
        this.seedDefaultLayers()
        this.activeLayoutId = 0
        this.markPending(false)
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
        this.notificationListeners.add(cb)
        return () => this.notificationListeners.delete(cb)
    }

    /** Test/demo helper: synthesize an inbound notification. */
    pushNotification(topic: string, payload: unknown): void {
        this.emitNotification(topic, payload)
    }

    async exportConfig(): Promise<ExportedFile[]> {
        const km = await this.getKeymap()
        return [
            {
                filename: `${this.deviceInfo.name}.mock.json`,
                mime: 'application/json',
                content: JSON.stringify(
                    {
                        deviceInfo: this.deviceInfo,
                        keymap: {
                            layers: km.layers.map((l) => ({
                                id: l.id,
                                name: l.name,
                                keys: l.keys.map((k) => ({
                                    kind: k.kind,
                                    params: k.params,
                                })),
                            })),
                            activeLayoutId: km.activeLayoutId,
                        },
                    },
                    null,
                    2,
                ),
            },
        ]
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

    /** Used by layouts referencing MOCK_CORNE_LAYOUT for storybook fidelity. */
    static get layoutForStory(): PhysicalLayout {
        return MOCK_CORNE_LAYOUT
    }
}
