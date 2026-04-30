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
    listGrantedDevices as web_hid_list,
    connectToGrantedDevice as web_hid_connect_granted,
    requestAndConnect as web_hid_request_new,
    type HidFilter,
} from '../transport/web-hid'
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
    connect as electron_serial_connect,
    list_devices as electron_serial_list_devices,
} from '../electron/serial.ts'
import {
    connect as electron_hid_connect,
    list_devices as electron_hid_list_devices,
} from '../electron/hid.ts'

function bleDiscovery(): { serviceUuid: string; charUuid: string } | null {
    for (const adapter of getAdapters()) {
        const ble = adapter.discovery.ble
        if (ble) return { serviceUuid: ble.serviceUuid, charUuid: ble.charUuid }
    }
    return null
}

function hidDiscovery(): {
    vendorIds?: number[]
    usagePage?: number
    usage?: number
} | null {
    for (const adapter of getAdapters()) {
        const hid = adapter.discovery.hid
        if (hid) {
            return {
                vendorIds: hid.vendorIds,
                usagePage: hid.usagePage,
                usage: hid.usage,
            }
        }
    }
    return null
}

// WebHID requestDevice() takes a filters array — emit one filter per
// registered adapter so all firmware variants surface in the chooser.
function hidFilters(): HidFilter[] {
    const out: HidFilter[] = []
    for (const adapter of getAdapters()) {
        const hid = adapter.discovery.hid
        if (!hid) continue
        const vids =
            hid.vendorIds && hid.vendorIds.length > 0
                ? hid.vendorIds
                : [undefined]
        for (const vendorId of vids) {
            out.push({
                vendorId,
                usagePage: hid.usagePage,
                usage: hid.usage,
            })
        }
    }
    return out
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
        // pattern-check: skip — drop Noble fallback; BLE button uses native BlueZ on Linux via electron/ble.ts
        if (ble) {
            // electron/ble.ts routes Linux → BlueZ, others → Web Bluetooth.
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
        }
        transports.push({
            label: 'USB',
            communication: 'serial',
            pick_and_connect: {
                connect: electron_serial_connect,
                list: electron_serial_list_devices,
            },
        })
        const hid = hidDiscovery()
        if (hid) {
            transports.push({
                label: 'HID',
                communication: 'hid',
                pick_and_connect: {
                    connect: electron_hid_connect,
                    list: () => electron_hid_list_devices(hid),
                },
            })
        }
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

        if ('hid' in navigator) {
            const filters = hidFilters()
            transports.push({
                label: 'HID',
                communication: 'hid',
                pick_and_connect: {
                    list: () => web_hid_list(filters),
                    connect: web_hid_connect_granted,
                },
                request_new: () => web_hid_request_new(filters),
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
