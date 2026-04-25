// pattern-check: skip — refactoring existing module to use callbacks, no new abstraction
import { SerialPort } from 'serialport'
import type { BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import { IpcEvents } from '../shared/ipc-types'

const execAsync = promisify(exec)

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

const GENERIC_MANUFACTURERS = new Set(['microsoft', 'unknown', ''])

function isPnpFragment(s: string): boolean {
    return /&/.test(s)
}

// Cache of pnpId -> Windows "Bus reported device description" (the product
// descriptor set by the firmware, e.g. ZMK's CONFIG_USB_DEVICE_PRODUCT).
const winProductCache = new Map<string, string | null>()

// Read firmware-set USB product descriptor on Linux via sysfs.
// /sys/class/tty/<name>/device is symlink → USB interface dir; walk one
// level up to the USB device dir which holds the `product` file.
function getLinuxProductName(devPath: string): string | undefined {
    if (process.platform !== 'linux') return undefined
    try {
        const base = path.basename(devPath)
        const sysIface = fs.realpathSync(`/sys/class/tty/${base}/device`)
        const usbDir = path.resolve(sysIface, '..')
        const product = fs.readFileSync(path.join(usbDir, 'product'), 'utf8')
        const trimmed = product.trim()
        return trimmed || undefined
    } catch {
        return undefined
    }
}

async function getWindowsProductName(
    pnpId: string | undefined,
): Promise<string | undefined> {
    if (process.platform !== 'win32' || !pnpId) return undefined
    if (winProductCache.has(pnpId)) {
        return winProductCache.get(pnpId) ?? undefined
    }
    try {
        const ps = `Get-PnpDeviceProperty -InstanceId '${pnpId.replace(/'/g, "''")}' -KeyName 'DEVPKEY_Device_BusReportedDeviceDesc' | Select-Object -ExpandProperty Data`
        const { stdout } = await execAsync(
            `powershell.exe -NoProfile -NonInteractive -Command "${ps}"`,
            { timeout: 3000, windowsHide: true },
        )
        const name = stdout.trim()
        winProductCache.set(pnpId, name || null)
        return name || undefined
    } catch {
        winProductCache.set(pnpId, null)
        return undefined
    }
}

function buildFallbackLabel(port: {
    path: string
    manufacturer?: string
    serialNumber?: string
    vendorId?: string
    productId?: string
}): string {
    const vidPid =
        port.vendorId && port.productId
            ? `${port.vendorId.toUpperCase()}:${port.productId.toUpperCase()}`
            : ''

    const mfr = (port.manufacturer || '').trim()
    const mfrOk = mfr && !GENERIC_MANUFACTURERS.has(mfr.toLowerCase())

    const sn = (port.serialNumber || '').trim()
    const snOk = sn && !isPnpFragment(sn)

    const parts = [mfrOk ? mfr : null, vidPid || null, snOk ? sn : null].filter(
        (x): x is string => !!x,
    )
    return parts.length ? `${port.path} · ${parts.join(' · ')}` : port.path
}

export async function listSerialDevices(): Promise<SerialDeviceInfo[]> {
    try {
        const allPorts = await SerialPort.list()
        // Linux: drop kernel legacy UARTs (/dev/ttyS*) and any node lacking
        // USB metadata. Real USB CDC (ZMK /dev/ttyACM*, FTDI /dev/ttyUSB*)
        // always reports vendorId. Keeps non-Linux behavior unchanged.
        const ports =
            process.platform === 'linux'
                ? allPorts.filter((p) => !!p.vendorId)
                : allPorts
        const enriched = await Promise.all(
            ports.map(async (port) => {
                const linuxProduct = getLinuxProductName(port.path)
                if (linuxProduct) {
                    return { id: port.path, label: linuxProduct }
                }
                const product = await getWindowsProductName(port.pnpId)
                const label = product
                    ? `${product} (${port.path})`
                    : buildFallbackLabel(port)
                return { id: port.path, label }
            }),
        )
        return enriched
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

const HOTPLUG_POLL_MS = 2000

function fingerprint(devices: SerialDeviceInfo[]): string {
    return devices
        .map((d) => `${d.id}|${d.label}`)
        .sort()
        .join('\n')
}

export function startSerialDevicePolling(
    getWindows: () => BrowserWindow[],
): () => void {
    let last = ''
    let stopped = false

    const tick = async (): Promise<void> => {
        if (stopped) return
        const current = await listSerialDevices()
        const fp = fingerprint(current)
        if (fp !== last) {
            last = fp
            for (const w of getWindows()) {
                if (!w.isDestroyed()) {
                    w.webContents.send(
                        IpcEvents.SERIAL_DEVICES_CHANGED,
                        current,
                    )
                }
            }
        }
    }

    const id = setInterval(tick, HOTPLUG_POLL_MS)
    tick()

    return (): void => {
        stopped = true
        clearInterval(id)
    }
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
