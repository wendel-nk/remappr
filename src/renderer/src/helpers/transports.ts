import { TransportFactory } from '../components/Modals/ConnectModal.tsx'
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
    connect_ble as electron_ble_connect,
    isElectron,
} from '../electron/index.ts'

declare global {
    interface Window {
        __TAURI_INTERNALS__?: object
    }
}

const buildTransports = (): TransportFactory[] => {
    const transports: TransportFactory[] = []

    // Check if running in Electron
    const runningInElectron = isElectron()

    // Check if running in Tauri
    const runningInTauri = !!window.__TAURI_INTERNALS__

    if (runningInElectron) {
        // Electron environment - use Electron BLE transport
        // BLE is available via Web Bluetooth API in Electron
        if (navigator.bluetooth) {
            transports.push({
                label: 'BLE',
                communication: 'ble',
                isWireless: true,
                connect: electron_ble_connect,
            })
        }

        // Serial via Web Serial API (supported in Electron)
        if (navigator.serial) {
            transports.push({
                label: 'USB',
                communication: 'serial',
                connect: serial_connect,
            })
        }
    } else if (runningInTauri) {
        // Tauri environment - use Tauri native transports
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
