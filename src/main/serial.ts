import { SerialPort } from 'serialport'
import { BrowserWindow } from 'electron'

export interface SerialDeviceInfo {
    id: string
    label: string
    path: string
    manufacturer?: string
    serialNumber?: string
    vendorId?: string
    productId?: string
}

interface ActiveConnection {
    port: SerialPort
    path: string
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
            path: port.path,
            manufacturer: port.manufacturer,
            serialNumber: port.serialNumber,
            vendorId: port.vendorId,
            productId: port.productId,
        }))
    } catch (error) {
        console.error('Failed to list serial devices:', error)
        return []
    }
}

export async function connectSerial(
    deviceId: string,
    baudRate: number = 115200,
): Promise<boolean> {
    // Close existing connection if any
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

                activeConnection = {
                    port,
                    path: deviceId,
                }

                // Set up data handler
                port.on('data', (data: Buffer) => {
                    const windows = BrowserWindow.getAllWindows()
                    for (const win of windows) {
                        win.webContents.send(
                            'serial:data',
                            Array.from(new Uint8Array(data)),
                        )
                    }
                })

                // Set up error handler
                port.on('error', (err: Error) => {
                    console.error('Serial port error:', err)
                    const windows = BrowserWindow.getAllWindows()
                    for (const win of windows) {
                        win.webContents.send('serial:error', err.message)
                    }
                })

                // Set up close handler
                port.on('close', () => {
                    activeConnection = null
                    const windows = BrowserWindow.getAllWindows()
                    for (const win of windows) {
                        win.webContents.send('serial:disconnected')
                    }
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

export function isSerialConnected(): boolean {
    return activeConnection !== null && activeConnection.port.isOpen
}

export function getActiveConnectionPath(): string | null {
    return activeConnection?.path || null
}
