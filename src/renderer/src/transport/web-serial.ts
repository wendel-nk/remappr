import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import type { AvailableDevice } from '@/transport/types'

const BAUD_RATE = 12500

interface PortRecord {
    id: string
    label: string
    port: SerialPort
}

const portRegistry = new Map<string, SerialPort>()

function makeId(info: SerialPortInfo, fallbackIndex: number): string {
    const vid = info.usbVendorId?.toString(16) ?? 'novid'
    const pid = info.usbProductId?.toString(16) ?? 'nopid'
    return `web-serial:${vid}:${pid}:${fallbackIndex}`
}

// Web Serial only exposes vid/pid — the OS device name (e.g. "testkeyboard")
// is not part of SerialPortInfo. Map known ZMK-friendly vendor IDs to a
// friendlier label; the actual keyboard name can be fetched over RPC after
// a connection is established.
const KNOWN_VENDOR_LABELS: Record<number, string> = {
    0x1d50: 'ZMK Keyboard',
    0x239a: 'Adafruit Keyboard',
    0x303a: 'ESP32 Keyboard',
    0x2e8a: 'Raspberry Pi Pico Keyboard',
    0x16c0: 'V-USB / Teensy Keyboard',
    0x1915: 'Nordic Keyboard',
    0x05ac: 'Apple Keyboard',
    0x1209: 'Generic ZMK Keyboard',
}

function makeLabel(info: SerialPortInfo): string {
    const vid = info.usbVendorId
    if (vid !== undefined && KNOWN_VENDOR_LABELS[vid]) {
        return KNOWN_VENDOR_LABELS[vid]
    }
    return 'USB Keyboard'
}

function buildRecord(port: SerialPort, index: number): PortRecord {
    const info = port.getInfo()
    const id = makeId(info, index)
    return { id, label: makeLabel(info), port }
}

export async function listGrantedPorts(): Promise<AvailableDevice[]> {
    if (!navigator.serial) return []
    const ports = await navigator.serial.getPorts()
    portRegistry.clear()
    return ports.map((port, i) => {
        const record = buildRecord(port, i)
        portRegistry.set(record.id, record.port)
        return { id: record.id, label: record.label }
    })
}

async function openTransport(port: SerialPort): Promise<RpcTransport> {
    if (!port.readable || !port.writable) {
        await port.open({ baudRate: BAUD_RATE }).catch((e: unknown) => {
            if (e instanceof DOMException && e.name === 'NetworkError') {
                throw new Error(
                    'Failed to open the serial port. Check the permissions of the device and verify it is not in use by another process.',
                    { cause: e },
                )
            }
            throw e
        })
    }

    const info = port.getInfo()
    const label = makeLabel(info)

    const abortController = new AbortController()
    const sig = abortController.signal
    const abort_cb = async (): Promise<void> => {
        sig.removeEventListener('abort', abort_cb)
        await port.writable?.close().catch(() => undefined)
        await port.readable?.cancel().catch(() => undefined)
        await port.close().catch(() => undefined)
    }
    sig.addEventListener('abort', abort_cb)

    return {
        label,
        abortController,
        readable: port.readable!,
        writable: port.writable!,
    }
}

export async function connectToGrantedPort(
    device: AvailableDevice,
): Promise<RpcTransport> {
    const port = portRegistry.get(device.id)
    if (!port) {
        throw new Error(
            'Selected serial port is no longer available. Refresh the list.',
        )
    }
    return openTransport(port)
}

export async function requestAndConnect(): Promise<RpcTransport> {
    if (!navigator.serial) throw new Error('Web Serial not supported')
    const port = await navigator.serial.requestPort({})
    const index = portRegistry.size
    const record = buildRecord(port, index)
    portRegistry.set(record.id, record.port)
    return openTransport(port)
}
