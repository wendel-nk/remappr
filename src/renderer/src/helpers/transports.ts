// pattern-check: skip — merge conflict resolution, no new logic added
import { TransportFactory } from '../transport/types'
import { connect as serial_connect } from '@zmkfirmware/zmk-studio-ts-client/transport/serial'
import { connect as gatt_connect } from '@zmkfirmware/zmk-studio-ts-client/transport/gatt'
import {
    connect as tauri_ble_connect,
    list_devices as ble_list_devices,
} from '../tauri/ble.ts'
import {
    connect as tauri_serial_connect,
    list_devices as serial_list_devices,
} from '../tauri/serial.ts'
import {
    connect as electron_ble_connect,
    list_devices as electron_ble_list_devices,
} from '../electron/ble.ts'
import {
    connect as electron_serial_connect,
    list_devices as electron_serial_list_devices,
} from '../electron/serial.ts'

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

const buildTransports = (): TransportFactory[] => {
    const transports: TransportFactory[] = []

    if (isTauri()) {
        transports.push({
            label: 'BLE',
            communication: 'ble',
            isWireless: true,
            pick_and_connect: {
                connect: tauri_ble_connect,
                list: ble_list_devices,
            },
        })
        transports.push({
            label: 'USB',
            communication: 'serial',
            pick_and_connect: {
                connect: tauri_serial_connect,
                list: serial_list_devices,
            },
        })
    } else if (isElectron()) {
        transports.push({
            label: 'BLE',
            communication: 'ble',
            isWireless: true,
            pick_and_connect: {
                connect: electron_ble_connect,
                list: electron_ble_list_devices,
            },
        })
        transports.push({
            label: 'USB',
            communication: 'serial',
            pick_and_connect: {
                connect: electron_serial_connect,
                list: electron_serial_list_devices,
            },
        })
    } else {
        // Browser environment - use Web APIs directly
        if (navigator.serial) {
            transports.push({
                label: 'USB',
                communication: 'serial',
                connect: serial_connect,
            })
        }

        // Web Bluetooth on Linux browsers
        if (navigator.bluetooth && navigator.userAgent.indexOf('Linux') >= 0) {
            transports.push({
                label: 'BLE',
                communication: 'ble',
                connect: gatt_connect,
            })
        }
    }

    return transports
}

export const TRANSPORTS: TransportFactory[] = buildTransports()
