import type { BrowserWindow } from 'electron'

/**
 * Safety-net handler for navigator.serial.requestPort() calls in the renderer.
 *
 * The Electron serial transport uses pure IPC (node-serialport in main), so
 * this path should not fire in normal use. If it does, log loudly — it means
 * isElectron() regressed in the renderer and the browser fallback is active.
 * Auto-select first port so requestPort() does not throw, preventing a silent
 * user-facing failure during the diagnosis window.
 */
export function setupSerialDeviceSelection(window: BrowserWindow): void {
    window.webContents.session.on(
        'select-serial-port',
        (event, portList, _wc, callback) => {
            event.preventDefault()
            console.warn(
                '[serial-picker] select-serial-port fired — renderer should be using IPC path. Ports:',
                portList,
            )
            callback(portList.length > 0 ? portList[0].portId : '')
        },
    )
}
