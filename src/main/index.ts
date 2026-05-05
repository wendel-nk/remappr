// pattern-check: skip — merge conflict resolution, no new logic
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc-handlers'
import { registerBleIpcHandlers, setupBleDeviceSelection } from './ble-manager'
import { setupSerialDeviceSelection } from './serial-picker'
import { startSerialDevicePolling } from './serial'
import { silenceConsoleInProduction } from '../shared/logger'
import { checkForUpdates, registerUpdateIpc } from './update-checker'
import { registerWindowControlsIpc } from './window-controls'

silenceConsoleInProduction()

// Enable Web Bluetooth (navigator.bluetooth) in Chromium. Must run before
// app.whenReady(). Without this, Electron exposes no `navigator.bluetooth`
// and BLE device discovery silently fails in the renderer.
app.commandLine.appendSwitch('enable-experimental-web-platform-features')

function createWindow(): void {
    // Create the browser window.
    const isMac = process.platform === 'darwin'
    const isLinux = process.platform === 'linux'

    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        useContentSize: true,
        show: false,
        autoHideMenuBar: true,
        frame: false,
        ...(isMac
            ? {
                  titleBarStyle: 'hiddenInset',
                  trafficLightPosition: { x: 12, y: 10 },
              }
            : {}),
        ...(isLinux ? { icon } : {}),
        webPreferences: {
            preload: join(__dirname, '../preload/index.mjs'),
            sandbox: false,
            nodeIntegration: false,
            contextIsolation: true,
        },
    })

    // Grant Chromium device permissions so navigator.serial / navigator.bluetooth / navigator.hid
    // can surface pickers inside Electron. Gated by origin so external pages opened via
    // shell.openExternal cannot self-grant.
    const sess = mainWindow.webContents.session
    const devUrl = process.env['ELECTRON_RENDERER_URL']

    sess.setPermissionCheckHandler((_wc, permission, origin) => {
        const allowedOrigin =
            origin.startsWith('file://') ||
            (!!devUrl && origin.startsWith(devUrl))
        const p = permission as string
        return (
            allowedOrigin &&
            (p === 'serial' || p === 'bluetooth' || p === 'hid')
        )
    })

    sess.setPermissionRequestHandler((_wc, permission, cb) => {
        const p = permission as string
        cb(p === 'bluetooth' || p === 'serial' || p === 'hid')
    })

    sess.setDevicePermissionHandler((details) => {
        const t = details.deviceType as string
        return t === 'serial' || t === 'usb' || t === 'hid'
    })

    // ZMK Studio's BLE profile uses Just Works / no-input pairing. Auto-confirm
    // the simple-confirm path so paired-on-demand keyboards don't hang for 30s
    // waiting on a UI we don't render. confirmPin / providePin paths fall
    // through to deny so users see an explicit failure rather than a silent
    // stall — those flows would need a real PIN dialog.
    sess.setBluetoothPairingHandler((details, cb) => {
        if (details.pairingKind === 'confirm') return cb({ confirmed: true })
        cb({ confirmed: false })
    })

    // Safety-net handler for any stray navigator.serial.requestPort() calls.
    setupSerialDeviceSelection(mainWindow)

    // Set up BLE device selection handler for Web Bluetooth support
    setupBleDeviceSelection(mainWindow)

    mainWindow.on('ready-to-show', (): void => {
        mainWindow?.show()
    })

    mainWindow.webContents.once('did-finish-load', (): void => {
        void checkForUpdates(mainWindow)
    })

    // Bestow a synthetic user gesture each time the renderer finishes loading
    // so the initial BLE scan (navigator.bluetooth.requestDevice) doesn't
    // bounce with SecurityError. The event fires inside an executeJavaScript
    // call with userGesture=true, giving Web Bluetooth a transient activation.
    // The renderer's useConnection hook listens and re-runs loadDevices. Uses
    // .on() (not .once()) so HMR refreshes / in-renderer reloads also trigger
    // the auto-scan — the renderer's userActivation guard de-dupes.
    mainWindow.webContents.on('did-finish-load', (): void => {
        setTimeout(() => {
            mainWindow.webContents
                .executeJavaScript(
                    `window.dispatchEvent(new CustomEvent('electron-auto-scan'))`,
                    true,
                )
                .catch(() => undefined)
        }, 500)
    })

    mainWindow.webContents.setWindowOpenHandler(
        (details): { action: 'deny' } => {
            shell.openExternal(details.url)
            return { action: 'deny' }
        },
    )

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then((): void => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on(
        'browser-window-created',
        (_: unknown, window: BrowserWindow): void => {
            optimizer.watchWindowShortcuts(window)
        },
    )

    // Register all IPC handlers
    registerIpcHandlers(() => BrowserWindow.getAllWindows())
    registerBleIpcHandlers()
    registerUpdateIpc(() => BrowserWindow.getAllWindows()[0] ?? null)
    registerWindowControlsIpc(() => BrowserWindow.getAllWindows()[0] ?? null)

    // Start USB hotplug polling — pushes SERIAL_DEVICES_CHANGED on changes.
    startSerialDevicePolling(() => BrowserWindow.getAllWindows())

    createWindow()

    app.on('activate', function (): void {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', (): void => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
