// Note: This file is unused in the current codebase.
// The 'serialport' package is for Node.js native serial and is not compatible
// with the web/Electron renderer process.
// Use the Web Serial API via serial.ts or Tauri serial via tauri/serial.ts instead.
// import { SerialPort } from 'serialport';
import { TransportEventEmitter, AvailableDevice } from './types'

/**
 * SimpleSerialTransport - Placeholder for Node.js serialport-based transport
 *
 * This class is not currently used. If Node.js serial support is needed,
 * install the 'serialport' package and uncomment the implementation.
 */
export class SimpleSerialTransport {
    private _eventEmitter: TransportEventEmitter

    constructor(eventEmitter: TransportEventEmitter) {
        this._eventEmitter = eventEmitter
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async serialConnect(_id: string): Promise<boolean> {
        throw new Error(
            'SimpleSerialTransport is not implemented. Use Web Serial API or Tauri serial instead.',
        )
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async write(_data: Uint8Array): Promise<void> {
        throw new Error(
            'SimpleSerialTransport is not implemented. Use Web Serial API or Tauri serial instead.',
        )
    }

    async serialDisconnect(): Promise<void> {
        this._eventEmitter.emit('connection_disconnected', [])
    }

    async serialListDevices(): Promise<AvailableDevice[]> {
        return []
    }
}
