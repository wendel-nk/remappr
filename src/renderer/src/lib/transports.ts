// pattern-check: skip — merge conflict resolution, no new logic
import { TransportFactory } from '../transport/types'
import { connect as serial_connect } from '@zmkfirmware/zmk-studio-ts-client/transport/serial'
import { connect as gatt_connect } from '../transport/web-ble'
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
                list: tauri_serial_list_devices,
            },
        })
    } else if (isElectron()) {
        // BLE on Linux currently broken (BlueZ writes accepted but firmware
        // silent; noble setup blocked by nosuid mounts / adapter perms).
        // Disable BLE transports on Linux entirely until a working backend
        // exists. USB works.
        const isLinux = navigator.userAgent.indexOf('Linux') >= 0
        if (!isLinux) {
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
                label: 'BLE (Noble)',
                communication: 'ble',
                isWireless: true,
                pick_and_connect: {
                    connect: electron_noble_connect,
                    list: electron_noble_list_devices,
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
                connect: serial_connect,
            })
        }

        // Web Bluetooth disabled in browser builds: on Windows, ZMK
        // keyboards bonded as HID are invisible to the Web BT chooser
        // (OS hides connected HID devices), and ZMK Studio adv mode
        // requires &studio_unlock + a fresh pair. Net result: chooser
        // is empty for users. Use the Electron build (pnpm edev) for
        // BLE — it talks to the native BT stack and reaches bonded
        // devices. Re-enable here once a workable Web BT path exists.
        void gatt_connect
    }

    cachedTransports = transports
    return cachedTransports
}
