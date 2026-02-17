import { TransportFactory } from '../components/Modals/ConnectModal.tsx'
import { connect as serial_connect } from '@zmkfirmware/zmk-studio-ts-client/transport/serial'
import { connect as gatt_connect } from '@zmkfirmware/zmk-studio-ts-client/transport/gatt'
import {
    connect as tauri_ble_connect,
    list_devices as ble_list_devices,
} from '../tauri/ble.ts'
import {
    connect as tauri_serial_connect,
    list_devices as tauri_serial_list_devices,
} from '../tauri/serial.ts'
import {
    connect as electron_serial_connect,
    list_devices as electron_serial_list_devices,
} from '../electron/serial.ts'

declare global {
    interface Window {
        __TAURI_INTERNALS__?: object
    }
}

function isElectron(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.api !== 'undefined' &&
        typeof window.api.serial !== 'undefined'
    )
}

const buildTransports = (): TransportFactory[] => {
    const transports: TransportFactory[] = []

    // Check for Electron environment first
    if (isElectron()) {
        transports.push({
            label: 'USB',
            communication: 'serial',
            pick_and_connect: {
                connect: electron_serial_connect,
                list: electron_serial_list_devices,
            },
        })
        return transports
    }

    // Check for Tauri environment
    if (window.__TAURI_INTERNALS__) {
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
                list: tauri_serial_list_devices,
            },
        })
        return transports
    }

    // Web environment - use Web APIs
    if (navigator.serial) {
        transports.push({
            label: 'USB',
            communication: 'serial',
            connect: serial_connect,
        })
    }

    if (navigator.bluetooth && navigator.userAgent.indexOf('Linux') >= 0) {
        transports.push({
            label: 'BLE',
            communication: 'ble',
            connect: gatt_connect,
        })
    }

    return transports
}

export const TRANSPORTS: TransportFactory[] = buildTransports()
