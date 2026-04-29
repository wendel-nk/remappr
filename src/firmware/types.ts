export interface KeyAction {
    kind: string
    params: number[]
    label: KeyLabel
}

export interface HoldTapLabelData {
    behaviorName: string
    behaviorBinding: string
    tapParam: number
    tapDesc: string
    holdNodeKind: 'layer' | 'usage'
    holdParam: number
    holdLayerLabel?: string
    holdLayerMomentary?: string
    holdLayerName?: string
    holdUsageDesc?: string
    tooltip: string
}

export interface KeyLabel {
    primary: string
    primaryUsage?: number
    secondary?: string
    modifiers?: string
    description?: string
    bindingPrefix?: string
    holdTap?: HoldTapLabelData
}

export interface Layer {
    id: number
    name: string
    keys: KeyAction[]
}

export interface PhysicalLayoutKey {
    x: number
    y: number
    w: number
    h: number
    r?: number
    rx?: number
    ry?: number
}

export interface PhysicalLayout {
    id: number
    name: string
    keys: PhysicalLayoutKey[]
}

export interface Keymap {
    layers: Layer[]
    availableLayers: number
    activeLayoutId: number
    layouts: PhysicalLayout[]
}

export interface ActionType {
    id: string
    displayName: string
    description?: string
    slots: ActionSlot[]
}

export type ActionSlotKind =
    | 'hid'
    | 'modifier'
    | 'layer'
    | 'number'
    | 'enum'
    | 'action'

export interface ActionSlot {
    label: string
    kind: ActionSlotKind
    values?: { value: number; label: string }[]
    range?: { min: number; max: number }
    innerKinds?: string[]
}

export interface DeviceInfo {
    name: string
    firmware: string
    firmwareVersion?: string
    serialNumber?: string
}

export type LockState = 'locked' | 'unlocking' | 'unlocked' | 'not-applicable'

export interface AdapterNotification {
    topic: string
    payload: unknown
}

export interface KeyUpdate {
    layerId: number
    position: number
    action: KeyAction
}

export interface ExportedFile {
    filename: string
    mime: string
    content: string | Uint8Array
}

export type TransportKind = 'serial' | 'ble' | 'hid'
