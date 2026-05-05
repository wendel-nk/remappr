/// <reference types="electron-vite/node" />

declare module '*?asset' {
    const src: string
    export default src
}

declare const __APP_VERSION__: string

// pattern-check: skip — ambient module shim; package is loaded via dynamic
// import at runtime, but tsc must resolve the symbol at compile time even
// when the native module is not installed in the build container.
declare module 'node-hid' {
    export interface Device {
        path?: string
        vendorId: number
        productId: number
        product?: string
        manufacturer?: string
        serialNumber?: string
        usagePage?: number
        usage?: number
        interface?: number
    }

    export class HID {
        constructor(path: string)

        on(event: 'data', cb: (data: Buffer) => void): void
        on(event: 'error', cb: (err: Error) => void): void

        write(data: number[]): number

        close(): void
    }

    export function devices(): Device[]
}
