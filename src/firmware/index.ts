export type {
    ActionSlot,
    ActionSlotKind,
    ActionType,
    AdapterNotification,
    DeviceInfo,
    ExportedFile,
    KeyAction,
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

export { getAdapters, pickAdapter, registerAdapter } from './registry'
