// Pattern check: Adapter (Tier 1) — extended — extends src/firmware/qmk/adapter.ts probe-cache structure for Keychron 0xA0 handshake; reuses QmkKeyboardService for keymap r/w via VIA passthrough.
import type {
    Discovery,
    FirmwareAdapter,
    Probe,
    ProbeHint,
} from '@firmware/adapter'
import { TransportError } from '@firmware/errors'
import {
    createHidClientFromTransport,
    type HidClient,
} from '@firmware/hid/rawHidClient'
import { QmkKeyboardService, readQmkLayerCount } from '@firmware/qmk/service'
import type { KeyboardService } from '@firmware/service'
import type { Transport } from '@firmware/transport'
import type { DeviceInfo } from '@firmware/types'

import {
    KEYCHRON_PAYLOAD_SIZE,
    KEYCHRON_USAGE,
    KEYCHRON_USAGE_PAGE,
    type FeatureFlags,
    getFirmwareVersionCmd,
    getMiscProtocolVersionCmd,
    getProtocolVersionCmd,
    getSupportFeatureCmd,
    parseFeatureFlags,
    parseFirmwareVersion,
    parseMiscProtocolVersion,
    parseNotification,
    parseProtocolVersion,
} from './protocol'
import { keychronCodec } from './codec'

// pattern-check: skip — same shape as qmk/adapter.ts readTransportIds, kept inline to avoid cross-adapter import
function readTransportIds(transport: Transport): {
    vid?: number
    pid?: number
} {
    if (
        typeof transport.vid === 'number' &&
        typeof transport.pid === 'number'
    ) {
        return { vid: transport.vid, pid: transport.pid }
    }
    const m = (transport.label || '').match(/\b([0-9a-f]{4}):([0-9a-f]{4})\b/i)
    if (!m) return {}
    return { vid: Number.parseInt(m[1], 16), pid: Number.parseInt(m[2], 16) }
}
import { createRgbFacade } from './rgb'
import { createWirelessFacade } from './wireless'
import { getBoardById, matchBoard, type KeychronBoardPreset } from './boards'

const PROBE_DEADLINE_MS = 1500
const KEYCHRON_VID = 0x3434

// VIA does not expose matrix dimensions over the protocol — clients
// load them from the per-board keyboard.json. K5 Max default = 6×21.
const DEFAULT_ROWS = 6
const DEFAULT_COLS = 21

const KEYCHRON_DISCOVERY: Discovery = {
    hid: {
        vendorIds: [KEYCHRON_VID],
        usagePage: KEYCHRON_USAGE_PAGE,
        usage: KEYCHRON_USAGE,
    },
}

interface ProbedSession {
    client: HidClient
    deviceInfo: DeviceInfo
    layerCount: number
    feats: FeatureFlags
    miscNkro: boolean
    miscWirelessLpm: boolean
    miscDfuInfo: boolean
    rgbAvailable: boolean
}

const probedSessions = new WeakMap<Transport, ProbedSession>()

async function probeKeychronSession(
    transport: Transport,
): Promise<ProbedSession | null> {
    const client = createHidClientFromTransport(transport, {
        payloadSize: KEYCHRON_PAYLOAD_SIZE,
    })
    try {
        let proto
        try {
            const resp = await client.send(
                getProtocolVersionCmd(),
                PROBE_DEADLINE_MS,
            )
            proto = parseProtocolVersion(resp)
        } catch {
            // Not a Keychron-firmware device — release stream locks so the
            // next adapter can probe the same transport.
            await client.close().catch(() => undefined)
            return null
        }
        if (proto.protocolVersion < 0x02) {
            await client.close().catch(() => undefined)
            return null
        }

        let firmwareVersion = `kc-${proto.protocolVersion}`
        try {
            const fwResp = await client.send(
                getFirmwareVersionCmd(),
                PROBE_DEADLINE_MS,
            )
            firmwareVersion = parseFirmwareVersion(fwResp) || firmwareVersion
        } catch {
            // Optional.
        }

        const featResp = await client.send(
            getSupportFeatureCmd(),
            PROBE_DEADLINE_MS,
        )
        const feats = parseFeatureFlags(featResp)

        let miscNkro = false
        let miscWirelessLpm = false
        let miscDfuInfo = false
        try {
            const miscResp = await client.send(
                getMiscProtocolVersionCmd(),
                PROBE_DEADLINE_MS,
            )
            const misc = parseMiscProtocolVersion(miscResp)
            miscNkro = misc.miscFeatures.nkro
            miscWirelessLpm = misc.miscFeatures.wirelessLpm
            miscDfuInfo = misc.miscFeatures.dfuInfo
        } catch {
            // Older firmwares may not implement misc proto query.
        }

        const layerCount = await readQmkLayerCount(client)

        const ids = readTransportIds(transport)
        const deviceInfo: DeviceInfo = {
            name: transport.label || 'Keychron keyboard',
            firmware: 'keychron-qmk',
            firmwareVersion,
            vid: ids.vid,
            pid: ids.pid,
        }

        return {
            client,
            deviceInfo,
            layerCount,
            feats,
            miscNkro,
            miscWirelessLpm,
            miscDfuInfo,
            rgbAvailable: feats.keychronRgb,
        }
    } catch (err) {
        await client.close().catch(() => undefined)
        if (err instanceof TransportError) return null
        return null
    }
}

export interface KeychronAdapterOptions {
    rows?: number
    cols?: number
    encoders?: number
    boardId?: string
}

function resolveBoardPreset(
    opts: KeychronAdapterOptions,
    label: string,
): KeychronBoardPreset | null {
    if (opts.boardId) return getBoardById(opts.boardId)
    return matchBoard(label)
}

export function createKeychronAdapter(
    opts: KeychronAdapterOptions = {},
): FirmwareAdapter {
    const fallbackRows = opts.rows ?? DEFAULT_ROWS
    const fallbackCols = opts.cols ?? DEFAULT_COLS
    const fallbackEncoders = opts.encoders ?? 0

    return {
        id: 'keychron-qmk',
        displayName: 'Keychron (QMK)',
        discovery: KEYCHRON_DISCOVERY,

        async canHandle(
            transport: Transport,
            hint?: ProbeHint,
        ): Promise<Probe> {
            if (hint && hint.transportKind !== 'hid') {
                return {
                    ok: false,
                    reason: 'keychron-qmk requires HID transport',
                }
            }
            const cached = probedSessions.get(transport)
            if (cached) return { ok: true, deviceInfo: cached.deviceInfo }

            const session = await probeKeychronSession(transport)
            if (!session) {
                return { ok: false, reason: 'not a Keychron QMK device' }
            }
            probedSessions.set(transport, session)
            return { ok: true, deviceInfo: session.deviceInfo }
        },

        async connect(
            transport: Transport,
            signal: AbortSignal,
        ): Promise<KeyboardService> {
            let session = probedSessions.get(transport) ?? null
            if (session) {
                probedSessions.delete(transport)
            } else {
                session = await probeKeychronSession(transport)
                if (!session) {
                    throw new TransportError(
                        'Keychron QMK probe failed during connect',
                    )
                }
            }

            if (signal.aborted) {
                await session.client.close().catch(() => undefined)
                throw signal.reason ?? new Error('aborted')
            }
            const sessionRef = session
            signal.addEventListener(
                'abort',
                () => {
                    sessionRef.client
                        .close({ abortTransport: true })
                        .catch(() => undefined)
                },
                { once: true },
            )

            const wirelessFacade =
                (session.feats.bluetooth || session.feats.p24g) &&
                session.miscWirelessLpm
                    ? createWirelessFacade(session.client, {
                          feats: session.feats,
                          miscNkro: session.miscNkro,
                          miscDfuInfo: session.miscDfuInfo,
                      })
                    : null

            const rgb = session.rgbAvailable
                ? createRgbFacade(session.client)
                : undefined

            // State-notify pump: subscribe to unsolicited frames and fan
            // them out to facades that care.
            if (session.feats.stateNotify) {
                session.client.subscribe((frame) => {
                    const n = parseNotification(frame)
                    wirelessFacade?.onNotification(n)
                })
            }

            const preset = resolveBoardPreset(opts, transport.label ?? '')
            const rows = opts.rows ?? preset?.rows ?? fallbackRows
            const cols = opts.cols ?? preset?.cols ?? fallbackCols
            const encoders =
                opts.encoders ?? preset?.encoders ?? fallbackEncoders
            if (preset) {
                session.deviceInfo = {
                    ...session.deviceInfo,
                    name: preset.displayName,
                }
            }

            return QmkKeyboardService.create({
                deviceInfo: session.deviceInfo,
                client: session.client,
                rows,
                cols,
                layerCount: session.layerCount,
                capabilitiesOverride: {
                    notifications: session.feats.stateNotify,
                    exportFormats: ['via.json'],
                    encoders,
                },
                wireless: wirelessFacade?.api,
                rgb,
                codec: keychronCodec,
            })
        },
    }
}

export const keychronAdapter: FirmwareAdapter = createKeychronAdapter()
