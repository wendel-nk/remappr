// pattern-check: skip — small ipcMain handlers for window min/max/close, no abstraction
import { ipcMain, BrowserWindow } from 'electron'
import { IpcChannels } from '../shared/ipc-types'

export function registerWindowControlsIpc(
    getMainWindow: () => BrowserWindow | null,
): void {
    ipcMain.handle(IpcChannels.WINDOW_MINIMIZE, () => {
        getMainWindow()?.minimize()
    })

    ipcMain.handle(IpcChannels.WINDOW_MAXIMIZE_TOGGLE, () => {
        const win = getMainWindow()
        if (!win) return false
        if (win.isMaximized()) {
            win.unmaximize()
            return false
        }
        win.maximize()
        return true
    })

    ipcMain.handle(IpcChannels.WINDOW_CLOSE, () => {
        getMainWindow()?.close()
    })

    ipcMain.handle(IpcChannels.WINDOW_IS_MAXIMIZED, () => {
        return getMainWindow()?.isMaximized() ?? false
    })
}
