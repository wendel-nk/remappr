// pattern-check: skip — transport factory wires registered adapter discovery descriptors into platform transport implementations
import { getAdapters } from '@firmware'
import { TransportFactory } from '../transport/types'
import {
    listGrantedDevices as web_ble_list,
    connectToGrantedDevice as web_ble_connect_granted,
    requestAndConnect as web_ble_request_new,
} from '../transport/web-ble'
import {
    listGrantedPorts as web_serial_list,
    connectToGrantedPort as web_serial_connect_granted,
    requestAndConnect as web_serial_request_new,
} from '../transport/web-serial'
import {
    connect as tauri_ble_connect,
    list_devices as ble_list_devices,
} from '../tauri/ble.ts'
import {
    connect as tauri_serial_connect,
    list_devices as tauri_serial_list_devices,
} from '../tauri/serial.ts'
import {
    connect as electron_ble_connect,
    list_devices as electron_ble_list_devices,
} from '../electron/ble.ts'
import {
    connect as electron_noble_connect,
    list_devices as electron_noble_list_devices,
} from '../electron/noble-ble.ts'
import {
    connect as electron_serial_connect,
    list_devices as electron_serial_list_devices,
} from '../electron/serial.ts'

function bleDiscovery(): { serviceUuid: string; charUuid: string } | null {
    for (const adapter of getAdapters()) {
        const ble = adapter.discovery.ble
        if (ble) return { serviceUuid: ble.serviceUuid, charUuid: ble.charUuid }
    }
    return null
}

declare global {
    interface Window {
        __TAURI_INTERNALS__?: object
    }
}

export function isElectron(): boolean {
    return (
        typeof window.api !== 'undefined' &&
        typeof window.api?.invoke === 'function'
    )
}

export function isTauri(): boolean {
    return !!window.__TAURI_INTERNALS__
}

let cachedTransports: TransportFactory[] | null = null

export function getTransports(): TransportFactory[] {
    if (cachedTransports) return cachedTransports

    console.log('[transports] env detect', {
        hasApi: typeof window.api,
        hasElectron: typeof window.electron,
        isElectron: isElectron(),
        isTauri: isTauri(),
    })

    const transports: TransportFactory[] = []
    const ble = bleDiscovery()

    if (isTauri()) {
        if (ble) {
            transports.push({
                label: 'BLE',
                communication: 'ble',
                isWireless: true,
                pick_and_connect: {
                    connect: (dev) =>
                        tauri_ble_connect(dev, ble.serviceUuid, ble.charUuid),
                    list: () => ble_list_devices(ble.serviceUuid, ble.charUuid),
                },
            })
        }
        transports.push({
            label: 'USB',
            communication: 'serial',
            pick_and_connect: {
                connect: tauri_serial_connect,
                list: tauri_serial_list_devices,
            },
        })
    } else if (isElectron()) {
        const isLinux = navigator.userAgent.indexOf('Linux') >= 0
        if (!isLinux && ble) {
            transports.push({
                label: 'BLE',
                communication: 'ble',
                isWireless: true,
                pick_and_connect: {
                    connect: (dev) =>
                        electron_ble_connect(
                            dev,
                            ble.serviceUuid,
                            ble.charUuid,
                        ),
                    list: () =>
                        electron_ble_list_devices(
                            ble.serviceUuid,
                            ble.charUuid,
                        ),
                },
            })
            transports.push({
                label: 'BLE (Noble)',
                communication: 'ble',
                isWireless: true,
                pick_and_connect: {
                    connect: (dev) =>
                        electron_noble_connect(
                            dev,
                            ble.serviceUuid,
                            ble.charUuid,
                        ),
                    list: () =>
                        electron_noble_list_devices(
                            ble.serviceUuid,
                            ble.charUuid,
                        ),
                },
            })
        }
        transports.push({
            label: 'USB',
            communication: 'serial',
            pick_and_connect: {
                connect: electron_serial_connect,
                list: electron_serial_list_devices,
            },
        })
    } else {
        if (navigator.serial) {
            transports.push({
                label: 'USB',
                communication: 'serial',
                pick_and_connect: {
                    list: web_serial_list,
                    connect: web_serial_connect_granted,
                },
                request_new: web_serial_request_new,
            })
        }

        // Web Bluetooth disabled in browser builds — keep references
        // alive for future re-enable.
        void web_ble_list
        void web_ble_connect_granted
        void web_ble_request_new
    }

    cachedTransports = transports
    return cachedTransports
}
