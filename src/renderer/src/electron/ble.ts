// Pattern check: Adapter (Tier 1) — extended — Bluez adapter extends IpcTransportAdapter; Web-BT adapter extends TransportAdapter
/**
 * Electron BLE — two adapters under one descriptor.
 *
 * Linux: ElectronBluezAdapter (IPC to main-process BlueZ D-Bus client).
 * macOS/Windows: native CoreBluetooth/WinRT helpers over IPC.
 * Other: ElectronWebBluetoothAdapter (navigator.bluetooth in renderer).
 *
 * Discovery is platform-branched too: BlueZ paired-device list on Linux,
 * requestDevice() chooser elsewhere.
 */

import { IpcChannels, IpcEvents } from '../../../shared/ipc-types'
import type { Transport } from '@firmware'
import type { AvailableDevice } from '@/transport'
import { TransportAdapter } from '../transport/adapter/base'
import {
    electronIpc,
    type IpcConnectResult,
    IpcTransportAdapter,
} from '../transport/adapter/ipc-adapter'
import { registerTransport } from '../transport/adapter/registry'
import type { BleDiscovery } from '../transport/adapter/discovery'
import {
    bleOptionalServices,
    electronBleBackend,
    resolveBleEndpoint,
} from '../transport/bleEndpoints'

/* --- module state for Web Bluetooth chooser flow ------------------------ */

let pendingDevicePromise: Promise<BluetoothDevice> | null = null
const SCAN_COLLECTION_MS = 5000
let scanToken = 0
let lastSelectedDeviceId: string | null = null
const deviceRegistry = new Map<string, BluetoothDevice>()
const pendingDeviceIds = new Set<string>()

/**
 * Shared promise for an in-flight Web Bluetooth scan. React StrictMode
 * + the main-process auto-scan kick can fire 3 concurrent listDevices()
 * calls on initial mount. Returning the same promise dedupes them into a
 * single scan window.
 */
let inFlightScan: Promise<AvailableDevice[]> | null = null

let cachedPlatform: string | null = null

async function getPlatform(): Promise<string> {
    if (cachedPlatform) return cachedPlatform
    cachedPlatform = (await window.api.invoke(
        IpcChannels.GET_PLATFORM,
    )) as string
    return cachedPlatform
}

/* --- discovery ---------------------------------------------------------- */

async function listBluezDevices(
    endpoints: readonly BleDiscovery[],
): Promise<AvailableDevice[]> {
    try {
        const devices = (await window.api.invoke(
            IpcChannels.BLUEZ_LIST_DEVICES,
            { endpoints },
        )) as AvailableDevice[]
        return devices
    } catch (e) {
        console.error('[electron/ble] BLUEZ_LIST_DEVICES failed:', e)
        return []
    }
}

async function listMacosBleDevices(
    endpoints: readonly BleDiscovery[],
): Promise<AvailableDevice[]> {
    try {
        return (await window.api.invoke(IpcChannels.MACOS_BLE_LIST_DEVICES, {
            endpoints,
        })) as AvailableDevice[]
    } catch (e) {
        console.error('[electron/ble] MACOS_BLE_LIST_DEVICES failed:', e)
        return []
    }
}

async function listWindowsBleDevices(
    endpoints: readonly BleDiscovery[],
): Promise<AvailableDevice[]> {
    try {
        return (await window.api.invoke(IpcChannels.WINDOWS_BLE_LIST_DEVICES, {
            endpoints,
        })) as AvailableDevice[]
    } catch (e) {
        console.error('[electron/ble] WINDOWS_BLE_LIST_DEVICES failed:', e)
        return []
    }
}

async function listWebBluetoothDevices(
    endpoints: readonly BleDiscovery[],
): Promise<AvailableDevice[]> {
    if (!navigator.bluetooth) {
        console.warn('[electron/ble] navigator.bluetooth missing')
        return []
    }

    const granted = await listGrantedWebBluetoothDevices()

    // Skip the scan entirely without a transient user activation —
    // requestDevice would reject with SecurityError and we'd waste a
    // BLE_START_SCAN IPC roundtrip. Mount-time loadDevices() has no
    // gesture; the main-process auto-scan event (executeJavaScript with
    // userGesture: true) is the only entry that will actually scan.
    if (
        typeof navigator.userActivation !== 'undefined' &&
        !navigator.userActivation.isActive
    ) {
        return granted
    }

    // Dedupe concurrent callers within the same gesture window.
    if (inFlightScan) return inFlightScan
    inFlightScan = runScan(endpoints).finally(() => {
        inFlightScan = null
    })
    const scanned = await inFlightScan
    const merged = new Map(granted.map((d) => [d.id, d]))
    for (const device of scanned) merged.set(device.id, device)
    return [...merged.values()]
}

async function listGrantedWebBluetoothDevices(): Promise<AvailableDevice[]> {
    const getDevices = (
        navigator.bluetooth as Bluetooth & {
            getDevices?: () => Promise<BluetoothDevice[]>
        }
    ).getDevices
    if (typeof getDevices !== 'function') return []
    try {
        const devices = await getDevices.call(navigator.bluetooth)
        return devices.map((device) => {
            deviceRegistry.set(device.id, device)
            return {
                id: device.id,
                label: device.name || 'BLE Device',
            }
        })
    } catch (error) {
        console.warn('[electron/ble] getDevices failed:', error)
        return []
    }
}

async function runScan(
    endpoints: readonly BleDiscovery[],
): Promise<AvailableDevice[]> {
    const myToken = ++scanToken

    if (pendingDevicePromise) {
        window.api.invoke(IpcChannels.BLE_STOP_SCAN).catch(() => {})
        pendingDevicePromise = null
    }
    pendingDeviceIds.clear()

    // Do NOT await — Chromium consumes the user-activation token across
    // awaits, which would make requestDevice() throw.
    window.api.invoke(IpcChannels.BLE_START_SCAN).catch((e) => {
        console.error('[electron/ble] BLE_START_SCAN failed:', e)
    })

    // pattern-check: skip — bug fix: bail fast on requestDevice rejection.
    // Web Bluetooth `filters: [{ services }]` matches the BLE *advertisement*
    // payload, not GATT services exposed after connect. ZMK firmware does not
    // advertise its Studio service UUID, so a service-UUID filter would yield
    // an empty chooser. Use acceptAllDevices + optionalServices and let the
    // renderer pick.
    try {
        pendingDevicePromise = navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: bleOptionalServices(endpoints),
        })
    } catch (e) {
        console.error('[electron/ble] requestDevice threw:', e)
        return []
    }

    // pattern-check: skip — bug fix: drop early-finish debounce, keep collecting until ceiling
    return new Promise<AvailableDevice[]>((resolve) => {
        let latestDevices: AvailableDevice[] = []
        let settled = false

        const finish = (): void => {
            if (settled) return
            settled = true
            clearTimeout(ceilingTimer)
            unlisten()
            resolve(latestDevices)
        }

        const bail = (): void => {
            if (settled) return
            settled = true
            clearTimeout(ceilingTimer)
            unlisten()
            resolve([])
        }

        // requestDevice rejection ⇒ bail immediately. SecurityError is the
        // on-mount no-user-gesture case — common, expected; user clicks the
        // Scan/Refresh button to retry inside a gesture.
        pendingDevicePromise!.catch((e: unknown) => {
            pendingDevicePromise = null
            pendingDeviceIds.clear()
            if (e instanceof DOMException && e.name === 'SecurityError') {
                console.info(
                    '[electron/ble] BLE scan needs a user gesture — click Scan / Refresh',
                )
            } else {
                console.warn('[electron/ble] requestDevice rejected:', e)
            }
            bail()
        })

        // Collect every BLE_DEVICES_DISCOVERED event for the full ceiling
        // window. Earlier debounce-after-first-event optimisation cut scans
        // short — BLE peripherals advertise across multiple seconds.
        const unlisten = window.api.on(
            IpcEvents.BLE_DEVICES_DISCOVERED,
            (...args: unknown[]) => {
                if (myToken !== scanToken) {
                    bail()
                    return
                }
                latestDevices = args[0] as AvailableDevice[]
                pendingDeviceIds.clear()
                for (const device of latestDevices) {
                    pendingDeviceIds.add(device.id)
                }
            },
        )

        const ceilingTimer = setTimeout(finish, SCAN_COLLECTION_MS)
    })
}

export async function list_devices(
    endpoints: readonly BleDiscovery[],
): Promise<AvailableDevice[]> {
    switch (electronBleBackend(await getPlatform())) {
        case 'bluez':
            return listBluezDevices(endpoints)
        case 'corebluetooth':
            return listMacosBleDevices(endpoints)
        case 'winrt':
            return listWindowsBleDevices(endpoints)
        case 'web-bluetooth':
            return listWebBluetoothDevices(endpoints)
    }
}

/* --- adapters ----------------------------------------------------------- */

export class ElectronBluezAdapter extends IpcTransportAdapter {
    constructor(
        private readonly dev: AvailableDevice,
        private readonly endpoints: readonly BleDiscovery[],
    ) {
        super(electronIpc, dev.label ?? 'BLE Device')
    }

    protected async connectIpc(): Promise<IpcConnectResult> {
        const result = (await window.api.invoke(IpcChannels.BLUEZ_CONNECT, {
            devicePath: this.dev.id,
            endpoints: this.endpoints,
        })) as {
            ok: boolean
            label?: string
            firmwareAdapterId?: string
            error?: string
        }
        if (!result.ok) {
            throw new Error(result.error ?? 'Failed to connect via BlueZ')
        }
        return {
            label: result.label ?? this.dev.label ?? 'BLE Device',
            firmwareAdapterId: result.firmwareAdapterId,
        }
    }
}

export class ElectronMacosBleAdapter extends IpcTransportAdapter {
    constructor(
        private readonly dev: AvailableDevice,
        private readonly endpoints: readonly BleDiscovery[],
    ) {
        super(electronIpc, dev.label ?? 'BLE Device')
    }

    protected async connectIpc(): Promise<IpcConnectResult> {
        const result = (await window.api.invoke(IpcChannels.MACOS_BLE_CONNECT, {
            deviceId: this.dev.id,
            endpoints: this.endpoints,
        })) as {
            ok: boolean
            label?: string
            firmwareAdapterId?: string
            error?: string
        }
        if (!result.ok) {
            throw new Error(
                result.error ?? 'Failed to connect through CoreBluetooth',
            )
        }
        return {
            label: result.label ?? this.dev.label ?? 'BLE Device',
            firmwareAdapterId: result.firmwareAdapterId,
        }
    }
}

export class ElectronWindowsBleAdapter extends IpcTransportAdapter {
    constructor(
        private readonly dev: AvailableDevice,
        private readonly endpoints: readonly BleDiscovery[],
    ) {
        super(electronIpc, dev.label ?? 'BLE Device')
    }

    protected async connectIpc(): Promise<IpcConnectResult> {
        const result = (await window.api.invoke(
            IpcChannels.WINDOWS_BLE_CONNECT,
            {
                deviceId: this.dev.id,
                endpoints: this.endpoints,
            },
        )) as {
            ok: boolean
            label?: string
            firmwareAdapterId?: string
            error?: string
        }
        if (!result.ok) {
            throw new Error(
                result.error ?? 'Failed to connect through Windows Bluetooth',
            )
        }
        return {
            label: result.label ?? this.dev.label ?? 'BLE Device',
            firmwareAdapterId: result.firmwareAdapterId,
        }
    }
}

export class ElectronWebBluetoothAdapter extends TransportAdapter {
    constructor(
        private readonly dev: AvailableDevice,
        private readonly endpoints: readonly BleDiscovery[],
    ) {
        super()
        this.label = dev.label ?? 'BLE Device'
    }

    async connect(): Promise<Transport> {
        if (!navigator.bluetooth) {
            throw new Error(
                'Web Bluetooth API not available in this Electron build',
            )
        }

        const usePendingSelection =
            pendingDevicePromise !== null && pendingDeviceIds.has(this.dev.id)
        let device: BluetoothDevice | undefined
        if (usePendingSelection) {
            const currentRequest = pendingDevicePromise
            if (!currentRequest) {
                throw new Error(
                    'BLE scan expired. Refresh the device list and try again.',
                )
            }
            const selected = await window.api.invoke(
                IpcChannels.BLE_SELECT_DEVICE,
                this.dev.id,
            )
            if (!selected) throw new Error('Failed to select BLE device')
            lastSelectedDeviceId = this.dev.id
            device = await currentRequest
            pendingDevicePromise = null
            pendingDeviceIds.clear()
            deviceRegistry.set(device.id, device)

            if (lastSelectedDeviceId !== this.dev.id) {
                throw new Error(
                    'BLE device selection mismatch — refresh and try again',
                )
            }
        } else {
            device = deviceRegistry.get(this.dev.id)
            if (!device) {
                throw new Error(
                    'BLE scan expired. Refresh the device list and try again.',
                )
            }
        }

        if (!usePendingSelection && pendingDevicePromise) {
            await window.api.invoke(IpcChannels.BLE_STOP_SCAN)
            pendingDevicePromise = null
            pendingDeviceIds.clear()
        }

        if (!device.gatt)
            throw new Error('GATT not available on selected device')

        let server: BluetoothRemoteGATTServer
        try {
            server = device.gatt.connected
                ? device.gatt
                : await device.gatt.connect()
        } catch (e) {
            // Windows holds the GATT exclusively when the keyboard is
            // connected at the OS level — Web Bluetooth gets NetworkError.
            // Translate the message so users know what to do.
            const platform = await getPlatform()
            if (
                platform === 'win32' &&
                e instanceof DOMException &&
                e.name === 'NetworkError'
            ) {
                throw new Error(
                    'GATT connect failed. On Windows, disconnect the keyboard from Bluetooth settings (Settings → Bluetooth & devices → … → Disconnect, do NOT remove), then retry.',
                    { cause: e },
                )
            }
            throw e
        }
        let resolved: Awaited<ReturnType<typeof resolveBleEndpoint>>
        try {
            resolved = await resolveBleEndpoint(server, this.endpoints)
        } catch (error) {
            if (
                error instanceof DOMException &&
                error.name === 'SecurityError'
            ) {
                deviceRegistry.delete(device.id)
                throw new Error(
                    'Bluetooth service permission is stale. Refresh the device list and select the keyboard again.',
                    { cause: error },
                )
            }
            throw error
        }
        const { endpoint, characteristic } = resolved
        await characteristic.startNotifications()

        const { writable: respWritable, readable } =
            new TransformStream<Uint8Array>()
        const responseWriter = respWritable.getWriter()

        const onValueChanged = async (event: Event): Promise<void> => {
            const target = event.target as BluetoothRemoteGATTCharacteristic
            const v = target?.value
            if (!v) return
            try {
                await responseWriter.write(
                    new Uint8Array(v.buffer, v.byteOffset, v.byteLength),
                )
            } catch {
                /* stream closed */
            }
        }

        characteristic.addEventListener(
            'characteristicvaluechanged',
            onValueChanged,
        )

        const writable = new WritableStream<Uint8Array>({
            async write(chunk) {
                await characteristic.writeValueWithoutResponse(
                    new Uint8Array(chunk),
                )
            },
        })

        const cleanup = (): void => {
            characteristic.removeEventListener(
                'characteristicvaluechanged',
                onValueChanged,
            )
            device.removeEventListener('gattserverdisconnected', onDisconnected)
        }

        const onDisconnected = (): void => {
            cleanup()
            responseWriter.close().catch(() => {})
        }

        device.addEventListener('gattserverdisconnected', onDisconnected)

        const onAbort = async (): Promise<void> => {
            cleanup()
            // Stop CCCD notifications before disconnecting. Skipping this on
            // Windows can keep the OS BLE stack holding the GATT handle, which
            // makes the next connect attempt fail with NetworkError.
            try {
                await characteristic.stopNotifications()
            } catch {
                /* already torn down */
            }
            responseWriter.close().catch(() => {})
            if (device.gatt?.connected) device.gatt.disconnect()
            this.abortController.signal.removeEventListener('abort', onAbort)
        }
        this.abortController.signal.addEventListener('abort', onAbort)

        if (device.name) this.label = device.name

        return {
            label: this.label,
            abortController: this.abortController,
            readable,
            writable,
            firmwareAdapterId: endpoint.adapterId,
        }
    }
}

/* --- registration ------------------------------------------------------- */

async function pickBleAdapter(
    dev: AvailableDevice,
    endpoints: readonly BleDiscovery[],
): Promise<Transport> {
    switch (electronBleBackend(await getPlatform())) {
        case 'bluez':
            return new ElectronBluezAdapter(dev, endpoints).connect()
        case 'corebluetooth':
            return new ElectronMacosBleAdapter(dev, endpoints).connect()
        case 'winrt':
            return new ElectronWindowsBleAdapter(dev, endpoints).connect()
        case 'web-bluetooth':
            return new ElectronWebBluetoothAdapter(dev, endpoints).connect()
    }
}

registerTransport({
    id: 'electron:ble',
    envs: 'electron',
    create(ctx) {
        return {
            label: 'BLE',
            communication: 'ble',
            isWireless: true,
            pick_and_connect: {
                // Firmware clients are loaded asynchronously. Resolve their BLE
                // endpoints at use time so a client registered after Electron's
                // transport registry was built is still discoverable.
                list: () => list_devices(ctx.bleDiscoveryAll()),
                connect: (dev) => pickBleAdapter(dev, ctx.bleDiscoveryAll()),
            },
        }
    },
})
