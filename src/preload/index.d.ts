import { ElectronAPI } from '@electron-toolkit/preload'
import type { ElectronIpcApi } from '../shared/ipc-types'

declare global {
    interface Window {
        electron: ElectronAPI
        api: ElectronIpcApi
    }
}
