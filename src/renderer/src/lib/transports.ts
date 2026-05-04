// pattern-check: skip — wires capability methods + adds Adapter for change events
import { TransportFactory } from '../transport/types'
import {
    connectToGrantedDevice as web_ble_connect_granted,
    forgetGrantedDevice as web_ble_forget,
    listGrantedDevices as web_ble_list,
    requestAndConnect as web_ble_request_new,
} from '../transport/web-ble'
import {
    connectToGrantedPort as web_serial_connect_granted,
    forgetGrantedPort as web_serial_forget,
    listGrantedPorts as web_serial_list,
    onPortsChanged as web_serial_on_ports_changed,
    requestAndConnect as web_serial_request_new,
    setUserDeviceName as web_serial_set_user_name,
} from '../transport/web-serial'
import {
    connect as electron_serial_connect,
    list_devices as electron_serial_list_devices,
    onDevicesChanged as electron_on_devices_changed,
} from '../electron/serial.ts'
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
                pick_and_connect: {
                    list: web_serial_list,
                    connect: web_serial_connect_granted,
                },
                request_new: web_serial_request_new,
                renameDevice: (device, name) =>
                    web_serial_set_user_name(device.id, name),
                forgetDevice: (device) => web_serial_forget(device.id),
            })
        }

        // Web Bluetooth disabled in browser builds: on Windows, ZMK
        // keyboards bonded as HID are invisible to the Web BT chooser
        // (OS hides connected HID devices), and ZMK Studio adv mode
        // requires &studio_unlock + a fresh pair. Net result: chooser
        // is empty for users. Use the Electron build (pnpm edev) for
        // BLE — it talks to the native BT stack and reaches bonded
        // devices. Re-enable the block below once a workable Web BT
        // path exists. Shape mirrors the Web Serial branch above:
        // pick_and_connect lists previously-granted devices via
        // navigator.bluetooth.getDevices(), request_new opens the
        // chooser for first-time pairing.
        //
        // if (navigator.bluetooth) {
        //     transports.push({
        //         label: 'BLE',
        //         communication: 'ble',
        //         isWireless: true,
        //         pick_and_connect: {
        //             list: web_ble_list,
        //             connect: web_ble_connect_granted,
        //         },
        //         request_new: web_ble_request_new,
        //     })
        // }
        void web_ble_list
        void web_ble_connect_granted
        void web_ble_request_new
        void web_ble_forget
    }

    cachedTransports = transports
    return cachedTransports
}

// pattern-check: Adapter (Tier 1) — applied — unifies Electron + Web Serial change-event APIs into one subscribe signature
export function subscribeToTransportChanges(cb: () => void): () => void {
    if (isElectron()) {
        return electron_on_devices_changed(cb)
    }
    if (typeof navigator !== 'undefined' && navigator.serial) {
        return web_serial_on_ports_changed(cb)
    }
    return (): void => undefined
}
