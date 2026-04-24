// pattern-check: skip — refactoring existing module to use callbacks, no new abstraction
import { SerialPort } from 'serialport'

export interface SerialDeviceInfo {
    id: string
    label: string
}

export interface SerialEventCallbacks {
    onData: (data: number[]) => void
    onDisconnected: () => void
}

interface ActiveConnection {
    port: SerialPort
    path: string
    callbacks: SerialEventCallbacks
}

let activeConnection: ActiveConnection | null = null

export async function listSerialDevices(): Promise<SerialDeviceInfo[]> {
    try {
        const ports = await SerialPort.list()
        return ports.map((port) => ({
            id: port.path,
            label:
                port.manufacturer || port.serialNumber
                    ? `${port.manufacturer || 'Unknown'} ${port.serialNumber ? `(${port.serialNumber})` : ''}`
                    : port.path,
        }))
    } catch (error) {
        console.error('Failed to list serial devices:', error)
        return []
    }
}

export async function connectSerial(
    deviceId: string,
    callbacks: SerialEventCallbacks,
    baudRate: number = 115200,
): Promise<boolean> {
    if (activeConnection) {
        await disconnectSerial()
    }

    try {
        const port = new SerialPort({
            path: deviceId,
            baudRate,
            autoOpen: false,
        })

        return new Promise((resolve, reject) => {
            port.open((err) => {
                if (err) {
                    console.error('Failed to open serial port:', err)
                    reject(err)
                    return
                }

                activeConnection = { port, path: deviceId, callbacks }

                port.on('data', (data: Buffer) => {
                    callbacks.onData(Array.from(new Uint8Array(data)))
                })

                port.on('error', (err: Error) => {
                    console.error('Serial port error:', err)
                })

                port.on('close', () => {
                    activeConnection = null
                    callbacks.onDisconnected()
                })

                resolve(true)
            })
        })
    } catch (error) {
        console.error('Failed to connect to serial port:', error)
        throw error
    }
}

export async function disconnectSerial(): Promise<void> {
    if (!activeConnection) {
        return
    }

    return new Promise((resolve) => {
        activeConnection!.port.close((err) => {
            if (err) {
                console.error('Error closing serial port:', err)
            }
            activeConnection = null
            resolve()
        })
    })
}

export async function writeSerial(data: Uint8Array): Promise<void> {
    if (!activeConnection) {
        throw new Error('No active serial connection')
    }

    return new Promise((resolve, reject) => {
        activeConnection!.port.write(Buffer.from(data), (err) => {
            if (err) {
                reject(err)
                return
            }
            activeConnection!.port.drain((drainErr) => {
                if (drainErr) {
                    reject(drainErr)
                    return
                }
                resolve()
            })
        })
    })
}
