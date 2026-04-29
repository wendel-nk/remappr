// Pattern check: Adapter (Tier 1) — applied — wraps RpcTransport byte streams as VIA request/response HID client; isolates VIA framing from the byte-stream transport contract used by the rest of @firmware.
// Single in-flight request, fixed payload size, deadline per call.

import type { Transport } from '@firmware/transport'
import { TransportError } from '@firmware/errors'

import { VIA_PAYLOAD_SIZE } from './protocol'

export interface HidClient {
    send(frame: Uint8Array, timeoutMs?: number): Promise<Uint8Array>
    close(): Promise<void>
    onClosed(cb: (reason?: unknown) => void): () => void
}

export interface HidClientOpts {
    payloadSize?: number
    defaultTimeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 1500

export function createHidClientFromTransport(
    transport: Transport,
    opts: HidClientOpts = {},
): HidClient {
    const payloadSize = opts.payloadSize ?? VIA_PAYLOAD_SIZE
    const defaultTimeoutMs = opts.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS

    const reader = transport.readable.getReader()
    const writer = transport.writable.getWriter()

    let queue: Promise<unknown> = Promise.resolve()
    const closedListeners = new Set<(reason?: unknown) => void>()
    let closed = false
    let acc = new Uint8Array()

    function fireClosed(reason?: unknown): void {
        if (closed) return
        closed = true
        for (const cb of closedListeners) {
            try {
                cb(reason)
            } catch {
                /* ignore listener errors */
            }
        }
    }

    transport.abortController.signal.addEventListener(
        'abort',
        () => fireClosed(transport.abortController.signal.reason),
        { once: true },
    )

    async function readFrame(timeoutMs: number): Promise<Uint8Array> {
        const deadline = Date.now() + timeoutMs
        while (acc.length < payloadSize) {
            if (closed) throw new TransportError('VIA HID closed')
            const remaining = deadline - Date.now()
            if (remaining <= 0) {
                throw new TransportError(
                    `VIA HID read timeout after ${timeoutMs}ms`,
                )
            }
            const result = await Promise.race([
                reader.read(),
                new Promise<{ value: undefined; done: false; timeout: true }>(
                    (resolve) =>
                        setTimeout(
                            () =>
                                resolve({
                                    value: undefined,
                                    done: false,
                                    timeout: true,
                                }),
                            remaining,
                        ),
                ),
            ])
            if ('timeout' in result) {
                throw new TransportError(
                    `VIA HID read timeout after ${timeoutMs}ms`,
                )
            }
            const { value, done } = result
            if (done) {
                fireClosed('eof')
                throw new TransportError('VIA HID stream ended')
            }
            if (value && value.length > 0) {
                const merged = new Uint8Array(acc.length + value.length)
                merged.set(acc, 0)
                merged.set(value, acc.length)
                acc = merged
            }
        }
        const out = acc.slice(0, payloadSize)
        acc = acc.slice(payloadSize)
        return out
    }

    async function send(
        frame: Uint8Array,
        timeoutMs?: number,
    ): Promise<Uint8Array> {
        if (closed) throw new TransportError('VIA HID closed')
        let payload = frame
        if (frame.length !== payloadSize) {
            const buf = new Uint8Array(payloadSize)
            buf.set(frame.slice(0, payloadSize), 0)
            payload = buf
        }
        const deadline = timeoutMs ?? defaultTimeoutMs
        const work: Promise<Uint8Array> = queue
            .catch(() => undefined)
            .then(async () => {
                if (closed) throw new TransportError('VIA HID closed')
                await writer.write(payload)
                return readFrame(deadline)
            })
        queue = work.catch(() => undefined)
        return work
    }

    async function close(): Promise<void> {
        if (closed) return
        fireClosed('close')
        try {
            reader.releaseLock()
        } catch {
            /* lock may already be released */
        }
        try {
            writer.releaseLock()
        } catch {
            /* lock may already be released */
        }
        if (!transport.abortController.signal.aborted) {
            transport.abortController.abort('hid-client.close')
        }
    }

    return {
        send,
        close,
        onClosed(cb) {
            if (closed) {
                cb()
                return () => undefined
            }
            closedListeners.add(cb)
            return () => closedListeners.delete(cb)
        },
    }
}
