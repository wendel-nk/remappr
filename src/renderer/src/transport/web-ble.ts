import type { Transport } from '@firmware'
import { UserCancelledError } from '@firmware'
import type { AvailableDevice } from '@/transport/types'

const deviceRegistry = new Map<string, BluetoothDevice>()

function makeId(dev: BluetoothDevice): string {
    return `web-ble:${dev.id}`
}

function makeLabel(dev: BluetoothDevice): string {
    return dev.name || 'Unknown BLE Device'
}

async function openTransport(
    dev: BluetoothDevice,
    serviceUuid: string,
    charUuid: string,
): Promise<Transport> {
    if (!dev.gatt) throw new Error('No GATT server on selected device')

    const abortController = new AbortController()
    const label = makeLabel(dev)

    if (!dev.gatt.connected) {
        console.log('[web-ble] connecting GATT...')
        await dev.gatt.connect()
    }

    let svc: BluetoothRemoteGATTService
    try {
        svc = await dev.gatt.getPrimaryService(serviceUuid)
    } catch (e) {
        console.error(
            '[web-ble] device does not expose firmware studio service',
            serviceUuid,
            e,
        )
        dev.gatt.disconnect()
        throw new Error(
            'Selected device does not expose the firmware studio service. ' +
                'Make sure the firmware is built with the studio service enabled and the device is unlocked.',
        )
    }

    const char = await svc.getCharacteristic(charUuid)

    const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
            await char.stopNotifications().catch(() => undefined)
            await char.startNotifications()

            const vc = (ev: Event): void => {
                const target = ev.target as BluetoothRemoteGATTCharacteristic
                const buf = target?.value?.buffer
                if (!buf) return
                controller.enqueue(new Uint8Array(buf))
            }
            char.addEventListener('characteristicvaluechanged', vc)

            const cb = async (): Promise<void> => {
                char.removeEventListener('characteristicvaluechanged', vc)
                dev.removeEventListener('gattserverdisconnected', cb)
                controller.close()
            }
            dev.addEventListener('gattserverdisconnected', cb)
        },
    })

    const writable = new WritableStream<Uint8Array>({
        write(chunk) {
            return char.writeValueWithoutResponse(
                chunk.buffer.slice(
                    chunk.byteOffset,
                    chunk.byteOffset + chunk.byteLength,
                ) as ArrayBuffer,
            )
        },
    })

    const sig = abortController.signal
    const abort_cb = async (): Promise<void> => {
        sig.removeEventListener('abort', abort_cb)
        dev.gatt?.disconnect()
    }
    sig.addEventListener('abort', abort_cb)

    return { label, abortController, readable, writable }
}

/**
 * Returns BLE devices the origin has previously been granted access to
 * (Chrome 92+: navigator.bluetooth.getDevices). Empty for first-time
 * users — they pair via requestAndConnect() to populate the list.
 */
export async function listGrantedDevices(): Promise<AvailableDevice[]> {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator))
        return []
    const getDevices = (
        navigator.bluetooth as Bluetooth & {
            getDevices?: () => Promise<BluetoothDevice[]>
        }
    ).getDevices
    if (typeof getDevices !== 'function') return []
    try {
        const devs = await getDevices.call(navigator.bluetooth)
        deviceRegistry.clear()
        return devs.map((d) => {
            const id = makeId(d)
            deviceRegistry.set(id, d)
            return { id, label: makeLabel(d) }
        })
    } catch (e) {
        console.warn('[web-ble] getDevices failed', e)
        return []
    }
}

export async function connectToGrantedDevice(
    device: AvailableDevice,
    serviceUuid: string,
    charUuid: string,
): Promise<Transport> {
    const dev = deviceRegistry.get(device.id)
    if (!dev) {
        throw new Error(
            'Selected BLE device is no longer available. Refresh the list.',
        )
    }
    return openTransport(dev, serviceUuid, charUuid)
}

/**
 * Triggers the browser BLE chooser. Uses acceptAllDevices because some
 * ZMK firmware builds expose the Studio GATT service without including
 * it in the advertising payload — strict service filter shows empty.
 */
export async function requestAndConnect(
    serviceUuid: string,
    charUuid: string,
): Promise<Transport> {
    const dev = await navigator.bluetooth
        .requestDevice({
            acceptAllDevices: true,
            optionalServices: [serviceUuid],
        })
        .catch((e: unknown) => {
            if (e instanceof DOMException && e.name === 'NotFoundError') {
                throw new UserCancelledError(
                    'User cancelled the connection attempt',
                    { cause: e },
                )
            }
            throw e
        })

    console.log('[web-ble] device picked', {
        name: dev.name,
        id: dev.id,
        hasGatt: !!dev.gatt,
    })

    deviceRegistry.set(makeId(dev), dev)
    return openTransport(dev, serviceUuid, charUuid)
}

// Back-compat alias for the original single-call connect().
export const connect = requestAndConnect
