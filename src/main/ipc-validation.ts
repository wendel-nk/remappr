/**
 * Input validation utilities for IPC handlers.
 * Validates payloads received from the renderer to ensure type safety
 * and prevent malicious or malformed data from being processed.
 */

import type { AvailableDevice } from '../shared/ipc-types'

export function isAvailableDevice(value: unknown): value is AvailableDevice {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as Record<string, unknown>).label === 'string' &&
        typeof (value as Record<string, unknown>).id === 'string'
    )
}

export function isUint8Array(value: unknown): value is Uint8Array {
    return value instanceof Uint8Array || ArrayBuffer.isView(value)
}

export function validateAvailableDevice(value: unknown): AvailableDevice {
    if (!isAvailableDevice(value)) {
        throw new Error(
            'Invalid device payload: expected { label: string, id: string }',
        )
    }
    return value
}

export function validateUint8Array(value: unknown): Uint8Array {
    if (value instanceof Uint8Array) {
        return value
    }
    // IPC serialization may convert Uint8Array to a regular object with numeric keys,
    // or to a Buffer on the main process side
    if (Buffer.isBuffer(value)) {
        return new Uint8Array(value)
    }
    if (
        typeof value === 'object' &&
        value !== null &&
        'type' in value &&
        (value as Record<string, unknown>).type === 'Buffer' &&
        Array.isArray((value as Record<string, unknown>).data)
    ) {
        return new Uint8Array(
            (value as Record<string, unknown>).data as number[],
        )
    }
    throw new Error('Invalid data payload: expected Uint8Array or Buffer')
}
