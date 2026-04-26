import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import { UserCancelledError } from '@zmkfirmware/zmk-studio-ts-client/transport/errors'

const SERVICE_UUID = '00000000-0196-6107-c967-c5cfb1c2482a'
const RPC_CHRC_UUID = '00000001-0196-6107-c967-c5cfb1c2482a'

/**
 * Replacement for the upstream Web BLE connect that broadens the device
 * chooser. Some ZMK firmware builds expose the Studio GATT service but do
 * NOT include it in the BLE advertising payload, so the strict service
 * filter shows an empty chooser. This impl uses acceptAllDevices and
 * declares the Studio service as optional, then verifies it post-connect.
 */
export async function connect(): Promise<RpcTransport> {
    const dev = await navigator.bluetooth
        .requestDevice({
            acceptAllDevices: true,
            optionalServices: [SERVICE_UUID],
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

    if (!dev.gatt) throw new Error('No GATT server on selected device')

    const abortController = new AbortController()
    const label = dev.name || 'Unknown'

    if (!dev.gatt.connected) {
        console.log('[web-ble] connecting GATT...')
        await dev.gatt.connect()
    }

    let svc: BluetoothRemoteGATTService
    try {
        svc = await dev.gatt.getPrimaryService(SERVICE_UUID)
    } catch (e) {
        console.error(
            '[web-ble] device does not expose ZMK Studio service',
            SERVICE_UUID,
            e,
        )
        dev.gatt.disconnect()
        throw new Error(
            'Selected device does not expose the ZMK Studio service. ' +
                'Make sure firmware is built with CONFIG_ZMK_STUDIO=y and the device is unlocked.',
        )
    }

    const char = await svc.getCharacteristic(RPC_CHRC_UUID)

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
