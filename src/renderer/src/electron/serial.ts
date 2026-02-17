import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import type { AvailableDevice } from '../transport/types'

export async function list_devices(): Promise<Array<AvailableDevice>> {
    const devices = await window.api.serial.list()
    return devices.map((device) => ({
        id: device.id,
        label: device.label,
    }))
}

export async function connect(dev: AvailableDevice): Promise<RpcTransport> {
    const connected = await window.api.serial.connect(dev.id, 115200)
    if (!connected) {
        throw new Error('Failed to connect to serial device')
    }

    const abortController = new AbortController()

    // Create a TransformStream for readable data
    const { writable: responseWritable, readable } =
        new TransformStream<Uint8Array>()

    // Set up data listener
    const unsubscribeData = window.api.serial.onData(async (data: number[]) => {
        try {
            const writer = responseWritable.getWriter()
            await writer.write(new Uint8Array(data))
            writer.releaseLock()
        } catch (error) {
            console.error('Error writing to response stream:', error)
        }
    })

    // Set up disconnection listener
    const unsubscribeDisconnected = window.api.serial.onDisconnected(() => {
        cleanup()
        try {
            responseWritable.close()
        } catch {
            // Stream may already be closed
        }
    })

    // Set up error listener
    const unsubscribeError = window.api.serial.onError((error: string) => {
        console.error('Serial port error:', error)
    })

    // Create writable stream for sending data
    const writable = new WritableStream<Uint8Array>({
        async write(chunk) {
            await window.api.serial.write(Array.from(chunk))
        },
        async close() {
            await window.api.serial.disconnect()
        },
        abort() {
            window.api.serial.disconnect()
        },
    })

    const cleanup = (): void => {
        unsubscribeData()
        unsubscribeDisconnected()
        unsubscribeError()
    }

    // Set up abort handler
    const signal = abortController.signal
    const abortHandler = async (): Promise<void> => {
        cleanup()
        await window.api.serial.disconnect()
        signal.removeEventListener('abort', abortHandler)
    }
    signal.addEventListener('abort', abortHandler)

    return {
        label: dev.label,
        abortController,
        readable,
        writable,
    }
}

export async function disconnect(): Promise<void> {
    await window.api.serial.disconnect()
}
