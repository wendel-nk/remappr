import { ipcMain, BrowserWindow } from 'electron'

function getMainWindow(): BrowserWindow | null {
    const windows = BrowserWindow.getAllWindows()
    return windows.length > 0 ? windows[0] : null
}

function emitToRenderer(channel: string, data: unknown): void {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
        win.webContents.send(channel, data)
    }
}

export function registerTransportHandlers(): void {
    // Serial transport handlers
    ipcMain.handle(
        'serial:list-devices',
        async (): Promise<Array<{ label: string; id: string }>> => {
            // TODO: Implement actual serial device enumeration
            // This will use node-usb or serialport in a future iteration
            return []
        },
    )

    ipcMain.handle(
        'serial:connect',
        async (
            _event,
            device: { label: string; id: string },
        ): Promise<boolean> => {
            try {
                // TODO: Implement actual serial connection
                // This will use node-usb or serialport in a future iteration
                console.log('Serial connect requested for:', device.label)
                return false
            } catch (error) {
                console.error('Serial connect failed:', error)
                return false
            }
        },
    )

    ipcMain.handle('serial:disconnect', async (): Promise<void> => {
        // TODO: Implement actual serial disconnection
        emitToRenderer('transport:connection-disconnected', null)
    })

    // BLE transport handlers
    ipcMain.handle(
        'ble:list-devices',
        async (): Promise<Array<{ label: string; id: string }>> => {
            // TODO: Implement actual BLE device enumeration
            // This will use noble or @abandonware/noble in a future iteration
            return []
        },
    )

    ipcMain.handle(
        'ble:connect',
        async (
            _event,
            device: { label: string; id: string },
        ): Promise<boolean> => {
            try {
                // TODO: Implement actual BLE connection
                console.log('BLE connect requested for:', device.label)
                return false
            } catch (error) {
                console.error('BLE connect failed:', error)
                return false
            }
        },
    )

    // Common transport handlers
    ipcMain.handle(
        'transport:send-data',
        async (_event, data: number[]): Promise<void> => {
            // TODO: Implement actual data sending via active transport
            console.log('Transport send data:', data.length, 'bytes')
        },
    )

    ipcMain.handle('transport:close', async (): Promise<void> => {
        // TODO: Implement actual transport close
        emitToRenderer('transport:connection-disconnected', null)
    })
}
