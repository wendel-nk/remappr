/** Native CoreBluetooth bridge for macOS.
 *
 * Chromium's Web Bluetooth chooser cannot discover a BLE HID keyboard that is
 * already connected for typing because it has stopped advertising. The small
 * bundled Swift helper uses retrieveConnectedPeripherals(withServices:) to
 * open the keyboard's Studio GATT service through a second CoreBluetooth
 * central while macOS keeps its HID connection intact.
 */

import { app } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import type { AvailableDevice, BleDiscoveryPayload } from '../shared/ipc-types'
import { createLogger } from '../shared/logger'

const log = createLogger('macos-ble')
const DEVICE_PREFIX = 'corebluetooth:'

export interface MacosBleEventCallbacks {
    onData: (data: number[]) => void
    onDisconnected: () => void
}

interface HelperEvent {
    type?: unknown
    devices?: unknown
    label?: unknown
    firmwareAdapterId?: unknown
    data?: unknown
    message?: unknown
    error?: unknown
}

interface ActiveMacosBleConnection {
    process: ChildProcessWithoutNullStreams
    callbacks: MacosBleEventCallbacks
    intentionalClose: boolean
}

let active: ActiveMacosBleConnection | null = null
let knownDeviceIds = new Set<string>()

function helperPath(): string {
    return app.isPackaged
        ? join(process.resourcesPath, 'macos-ble-helper')
        : join(app.getAppPath(), 'build', 'macos-ble-helper')
}

function startHelper(
    configuration: Record<string, unknown>,
): ChildProcessWithoutNullStreams {
    const child = spawn(helperPath(), [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (message: string) => {
        const trimmed = message.trim()
        if (trimmed) log.warn(trimmed)
    })
    child.stdin.write(`${JSON.stringify(configuration)}\n`)
    return child
}

function parseHelperEvent(line: string): HelperEvent | null {
    try {
        const value = JSON.parse(line) as unknown
        return value && typeof value === 'object'
            ? (value as HelperEvent)
            : null
    } catch {
        return null
    }
}

export async function listMacosBleDevices(
    endpoints: readonly BleDiscoveryPayload[],
): Promise<AvailableDevice[]> {
    if (process.platform !== 'darwin') return []

    return await new Promise((resolve) => {
        const child = startHelper({ mode: 'list', endpoints })
        const lines = createInterface({ input: child.stdout })
        let settled = false
        const finish = (devices: AvailableDevice[]): void => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            lines.close()
            knownDeviceIds = new Set(devices.map((device) => device.id))
            resolve(devices)
        }

        lines.on('line', (line) => {
            const event = parseHelperEvent(line)
            if (event?.type !== 'devices' || !Array.isArray(event.devices)) {
                return
            }
            const devices = event.devices.flatMap((raw): AvailableDevice[] => {
                if (!raw || typeof raw !== 'object') return []
                const candidate = raw as { id?: unknown; label?: unknown }
                if (
                    typeof candidate.id !== 'string' ||
                    !candidate.id.startsWith(DEVICE_PREFIX) ||
                    typeof candidate.label !== 'string'
                ) {
                    return []
                }
                return [{ id: candidate.id, label: candidate.label }]
            })
            finish(devices)
        })
        child.once('error', (error) => {
            log.warn('helper failed to start:', error.message)
            finish([])
        })
        child.once('close', () => finish([]))
        const timer = setTimeout(() => {
            child.kill()
            finish([])
        }, 5000)
    })
}

export async function connectMacosBleDevice(
    deviceId: string,
    endpoints: readonly BleDiscoveryPayload[],
    callbacks: MacosBleEventCallbacks,
): Promise<{ label: string; firmwareAdapterId: string }> {
    if (process.platform !== 'darwin') {
        throw new Error('Native CoreBluetooth is only available on macOS')
    }
    if (!knownDeviceIds.has(deviceId)) {
        throw new Error('Unknown CoreBluetooth device; refresh the device list')
    }
    await disconnectMacosBleDevice()

    return await new Promise((resolve, reject) => {
        const child = startHelper({
            mode: 'connect',
            deviceId,
            endpoints,
        })
        const connection: ActiveMacosBleConnection = {
            process: child,
            callbacks,
            intentionalClose: false,
        }
        active = connection
        const lines = createInterface({ input: child.stdout })
        let connected = false
        let settled = false
        const fail = (message: string): void => {
            if (!settled) {
                settled = true
                clearTimeout(timer)
                reject(new Error(message))
            }
            if (active === connection) active = null
            child.kill()
        }

        lines.on('line', (line) => {
            const event = parseHelperEvent(line)
            if (!event || typeof event.type !== 'string') return
            if (
                event.type === 'ready' &&
                typeof event.label === 'string' &&
                typeof event.firmwareAdapterId === 'string'
            ) {
                log.info(`connected adapter=${event.firmwareAdapterId}`)
                connected = true
                settled = true
                clearTimeout(timer)
                resolve({
                    label: event.label,
                    firmwareAdapterId: event.firmwareAdapterId,
                })
            } else if (
                event.type === 'data' &&
                typeof event.data === 'string'
            ) {
                const bytes = Buffer.from(event.data, 'base64')
                callbacks.onData([...bytes])
            } else if (event.type === 'error') {
                fail(
                    typeof event.message === 'string'
                        ? event.message
                        : 'CoreBluetooth helper failed',
                )
            } else if (event.type === 'disconnected') {
                log.warn(
                    `CoreBluetooth disconnected: ${typeof event.error === 'string' && event.error ? event.error : 'no error reported'}`,
                )
            }
        })
        child.once('error', (error) => fail(error.message))
        child.once('close', (code) => {
            log.info(
                `helper closed code=${code} intentional=${connection.intentionalClose}`,
            )
            lines.close()
            if (active === connection) active = null
            if (!connected) {
                fail(`CoreBluetooth helper exited before connecting (${code})`)
            } else if (!connection.intentionalClose) {
                callbacks.onDisconnected()
            }
        })
        const timer = setTimeout(
            () => fail('Timed out connecting to the CoreBluetooth device'),
            12000,
        )
    })
}

export async function writeMacosBle(data: Uint8Array): Promise<void> {
    if (!active) throw new Error('No active CoreBluetooth connection')
    await new Promise<void>((resolve, reject) => {
        active!.process.stdin.write(
            `${JSON.stringify({ type: 'write', data: Buffer.from(data).toString('base64') })}\n`,
            (error) => (error ? reject(error) : resolve()),
        )
    })
}

export async function disconnectMacosBleDevice(): Promise<void> {
    const connection = active
    if (!connection) return
    active = null
    connection.intentionalClose = true
    connection.process.stdin.write(`${JSON.stringify({ type: 'close' })}\n`)
    const closed = new Promise<void>((resolve) => {
        connection.process.once('close', () => resolve())
    })
    const forced = new Promise<void>((resolve) => {
        setTimeout(() => {
            connection.process.kill()
            resolve()
        }, 1000)
    })
    await Promise.race([closed, forced])
}

export function hasActiveMacosBleConnection(): boolean {
    return active !== null
}
