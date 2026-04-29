export type {
    ActionSlot,
    ActionSlotKind,
    ActionType,
    AdapterNotification,
    DeviceInfo,
    ExportedFile,
    KeyAction,
    HoldTapLabelData,
    KeyLabel,
    KeyUpdate,
    Keymap,
    Layer,
    LockState,
    PhysicalLayout,
    PhysicalLayoutKey,
    TransportKind,
} from './types'

export type { Capabilities, KeyboardService } from './service'

export type {
    BleDiscovery,
    Discovery,
    FirmwareAdapter,
    HidDiscovery,
    Probe,
    ProbeHint,
} from './adapter'

export type { Transport } from './transport'

export {
    FirmwareError,
    LockedError,
    ProtocolError,
    TransportError,
    UnsupportedError,
} from './errors'

// Re-exported transport error: thrown by every transport factory when
// the user cancels a system picker (web-serial / web-bluetooth / native
// equivalents). Surfaced from @firmware so the renderer never needs to
// import @firmware/zmk for it.
export { UserCancelledError } from '@zmkfirmware/zmk-studio-ts-client/transport/errors'

export {
    resolveBindingLabels,
    type ResolvedBindingPosition,
    type ResolvedHoldTapDescriptor,
} from './labels'

export { getAdapters, pickAdapter, registerAdapter } from './registry'
