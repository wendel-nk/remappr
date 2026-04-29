/* eslint-disable @typescript-eslint/no-unused-vars */
// Pattern check: Adapter (Tier 1) — applied — backs src/firmware/adapter.ts FirmwareAdapter; QMK/VIA adapter stub. canHandle short-circuits until VIA HID transport wires up; connect throws with explicit guidance.
import type { Transport } from '@firmware/transport'

import type { Discovery, FirmwareAdapter, Probe } from '@firmware/adapter'
import type { KeyboardService } from '@firmware/service'
import { UnsupportedError } from '@firmware/errors'

// VIA convention: HID interface advertised at usagePage 0xFF60 / usage 0x61.
const QMK_DISCOVERY: Discovery = {
    hid: {
        usagePage: 0xff60,
        usage: 0x61,
    },
}

export const qmkAdapter: FirmwareAdapter = {
    id: 'qmk-via',
    displayName: 'QMK (VIA)',
    discovery: QMK_DISCOVERY,

    async canHandle(_transport: Transport): Promise<Probe> {
        // Stub: VIA probe (id_get_protocol_version, 0x01) is wired in Phase 6.
        return {
            ok: false,
            reason: 'QMK/VIA HID transport not yet implemented',
        }
    },

    async connect(
        _transport: Transport,
        _signal: AbortSignal,
    ): Promise<KeyboardService> {
        throw new UnsupportedError(
            'qmk-via.connect: VIA HID transport not yet implemented',
        )
    },
}
