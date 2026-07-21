import type { Transport } from '@firmware'
import { UserCancelledError } from '@firmware'
import type { AvailableDevice } from '@/transport/types'
import type { BleDiscovery } from './adapter/discovery'
import { registerTransport } from './adapter/registry'
import { bleOptionalServices, resolveBleEndpoint } from './bleEndpoints'

const WRITE_CHUNK_SIZE = 20
const deviceRegistry = new Map<string, BluetoothDevice>()

function makeId(dev: BluetoothDevice): string {
    return `web-ble:${dev.id}`
}

function makeLabel(dev: BluetoothDevice): string {
    return dev.name || 'Unknown BLE Device'
}

export function hasWebBluetooth(): boolean {
    return (
        typeof navigator !== 'undefined' &&
        'bluetooth' in navigator &&
        typeof navigator.bluetooth?.requestDevice === 'function'
    )
}

export function webBluetoothRequestOptions(
    endpoints: readonly BleDiscovery[],
): RequestDeviceOptions {
    return {
        // Some ZMK builds expose Studio without including its service UUID in
        // advertisements, so filtering by service would hide a valid keyboard.
        acceptAllDevices: true,
        optionalServices: bleOptionalServices(endpoints),
    }
}

async function openTransport(
    dev: BluetoothDevice,
    endpoints: readonly BleDiscovery[],
): Promise<Transport> {
    if (!dev.gatt) throw new Error('No GATT server on selected device')
    if (endpoints.length === 0) {
        throw new Error('No firmware Bluetooth endpoints are registered')
    }

    const abortController = new AbortController()
    const server = dev.gatt.connected ? dev.gatt : await dev.gatt.connect()

    let resolved: Awaited<ReturnType<typeof resolveBleEndpoint>>
    try {
        resolved = await resolveBleEndpoint(server, endpoints)
    } catch (error) {
        if (dev.gatt.connected) dev.gatt.disconnect()
        if (error instanceof DOMException && error.name === 'SecurityError') {
            throw new Error(
                'Bluetooth service permission is stale. Forget this device in Remappr, pair it again, and grant access to the Studio service.',
                { cause: error },
            )
        }
        if (error instanceof DOMException && error.name === 'NotFoundError') {
            throw new Error(
                'The selected device does not expose a supported firmware configuration service.',
                { cause: error },
            )
        }
        throw error
    }

    const { endpoint, characteristic } = resolved
    const { writable: responseWritable, readable } =
        new TransformStream<Uint8Array>()
    const responseWriter = responseWritable.getWriter()
    let detached = false

    const onValueChanged = async (event: Event): Promise<void> => {
        const target = event.target as BluetoothRemoteGATTCharacteristic
        const value = target?.value
        if (!value) return
        try {
            await responseWriter.write(
                new Uint8Array(
                    value.buffer,
                    value.byteOffset,
                    value.byteLength,
                ),
            )
        } catch {
            // The consumer closed while a final notification was in flight.
        }
    }

    const detach = (): void => {
        if (detached) return
        detached = true
        characteristic.removeEventListener(
            'characteristicvaluechanged',
            onValueChanged,
        )
        dev.removeEventListener('gattserverdisconnected', onDisconnected)
    }

    const onDisconnected = (): void => {
        detach()
        responseWriter.close().catch(() => undefined)
    }

    characteristic.addEventListener(
        'characteristicvaluechanged',
        onValueChanged,
    )
    dev.addEventListener('gattserverdisconnected', onDisconnected)
    try {
        await characteristic.startNotifications()
    } catch (error) {
        detach()
        if (dev.gatt.connected) dev.gatt.disconnect()
        throw error
    }

    const writable = new WritableStream<Uint8Array>({
        async write(chunk) {
            for (
                let offset = 0;
                offset < chunk.byteLength;
                offset += WRITE_CHUNK_SIZE
            ) {
                await characteristic.writeValueWithoutResponse(
                    chunk.slice(offset, offset + WRITE_CHUNK_SIZE),
                )
            }
        },
    })

    const onAbort = async (): Promise<void> => {
        abortController.signal.removeEventListener('abort', onAbort)
        detach()
        try {
            await characteristic.stopNotifications()
        } catch {
            // Device may already be disconnected.
        }
        responseWriter.close().catch(() => undefined)
        if (dev.gatt?.connected) dev.gatt.disconnect()
    }
    abortController.signal.addEventListener('abort', onAbort)

    return {
        label: makeLabel(dev),
        abortController,
        readable,
        writable,
        firmwareAdapterId: endpoint.adapterId,
    }
}

/** Devices previously granted to this web origin. This does not start a scan,
 * so it is the path that may recover an already-connected HID keyboard after
 * the user grants permission once through requestDevice(). */
export async function listGrantedDevices(): Promise<AvailableDevice[]> {
    if (!hasWebBluetooth()) return []
    const getDevices = (
        navigator.bluetooth as Bluetooth & {
            getDevices?: () => Promise<BluetoothDevice[]>
        }
    ).getDevices
    if (typeof getDevices !== 'function') {
        return [...deviceRegistry.entries()].map(([id, device]) => ({
            id,
            label: makeLabel(device),
        }))
    }

    const devices = await getDevices.call(navigator.bluetooth)
    deviceRegistry.clear()
    return devices.map((device) => {
        const id = makeId(device)
        deviceRegistry.set(id, device)
        return { id, label: makeLabel(device) }
    })
}

export async function connectToGrantedDevice(
    device: AvailableDevice,
    endpoints: readonly BleDiscovery[],
): Promise<Transport> {
    const granted = deviceRegistry.get(device.id)
    if (!granted) {
        throw new Error(
            'The browser no longer exposes this Bluetooth permission. Refresh the list or pair the keyboard again.',
        )
    }
    return openTransport(granted, endpoints)
}

export async function requestAndConnect(
    endpoints: readonly BleDiscovery[],
): Promise<Transport> {
    if (!hasWebBluetooth()) {
        throw new Error('Web Bluetooth is not available in this browser')
    }
    if (endpoints.length === 0) {
        throw new Error('No firmware Bluetooth endpoints are registered')
    }

    const device = await navigator.bluetooth
        .requestDevice(webBluetoothRequestOptions(endpoints))
        .catch((error: unknown) => {
            if (
                error instanceof DOMException &&
                error.name === 'NotFoundError'
            ) {
                throw new UserCancelledError(
                    'User cancelled the Bluetooth chooser',
                    { cause: error },
                )
            }
            throw error
        })

    deviceRegistry.set(makeId(device), device)
    return openTransport(device, endpoints)
}

export async function forgetGrantedDevice(deviceId: string): Promise<void> {
    const device = deviceRegistry.get(deviceId)
    if (!device) return
    const forget = (
        device as BluetoothDevice & { forget?: () => Promise<void> }
    ).forget
    if (typeof forget === 'function') {
        await forget.call(device).catch(() => undefined)
    }
    deviceRegistry.delete(deviceId)
}

registerTransport({
    id: 'web:ble',
    envs: 'web',
    create(ctx) {
        if (!hasWebBluetooth()) return null
        return {
            label: 'BLE',
            communication: 'ble',
            isWireless: true,
            pick_and_connect: {
                list: listGrantedDevices,
                connect: (device) =>
                    connectToGrantedDevice(device, ctx.bleDiscoveryAll()),
            },
            request_new: () => requestAndConnect(ctx.bleDiscoveryAll()),
            forgetDevice: (device) => forgetGrantedDevice(device.id),
        }
    },
})
