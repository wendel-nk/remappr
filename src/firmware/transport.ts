// pattern-check: skip neutral type re-export — bytes-stream Transport contract shared by every FirmwareAdapter.
import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'

export type Transport = RpcTransport & {
    /** Optional VID/PID surfaced by HID transports (used by VIA registry lookup). */
    vid?: number
    pid?: number
}
