// Pattern check: no GoF pattern (-) — rejected — unit tests for Keychron framing helpers, pure byte-level assertions, no abstraction.
import { describe, it, expect } from 'vitest'

import { ProtocolError } from '@firmware/errors'

import {
    KC_ID,
    KEYCHRON_PAYLOAD_SIZE,
    MISC_SUB,
    RGB_SUB,
    factoryResetCmd,
    getDefaultLayerCmd,
    getFirmwareVersionCmd,
    getLedCountCmd,
    getMiscProtocolVersionCmd,
    getNkroCmd,
    getProtocolVersionCmd,
    getSupportFeatureCmd,
    getWirelessLpmCmd,
    makeFrame,
    makeSubFrame,
    parseDefaultLayer,
    parseFeatureFlags,
    parseFirmwareVersion,
    parseLedCount,
    parseMiscProtocolVersion,
    parseNkro,
    parseProtocolVersion,
    parseWirelessLpm,
    rgbSaveCmd,
    setNkroCmd,
    setWirelessLpmCmd,
} from './protocol'

function frame(bytes: number[]): Uint8Array {
    const out = new Uint8Array(KEYCHRON_PAYLOAD_SIZE)
    out.set(bytes.slice(0, KEYCHRON_PAYLOAD_SIZE))
    return out
}

describe('keychron/protocol — framing', () => {
    it('makeFrame yields fixed 32-byte payload with id at byte 0', () => {
        const f = makeFrame(KC_ID.GET_PROTOCOL_VERSION, [1, 2, 3])
        expect(f.length).toBe(KEYCHRON_PAYLOAD_SIZE)
        expect(f[0]).toBe(0xa0)
        expect(f[1]).toBe(1)
        expect(f[2]).toBe(2)
        expect(f[3]).toBe(3)
        expect(f[4]).toBe(0)
    })

    it('makeSubFrame places sub-cmd at byte 1', () => {
        const f = makeSubFrame(
            KC_ID.MISC_CMD_GROUP,
            MISC_SUB.WIRELESS_LPM_SET,
            [1, 0xff, 0x00],
        )
        expect(f[0]).toBe(0xa7)
        expect(f[1]).toBe(0x0c)
        expect(f[2]).toBe(1)
        expect(f[3]).toBe(0xff)
        expect(f[4]).toBe(0x00)
    })

    it('rejects oversized body', () => {
        expect(() => makeFrame(0xa0, new Array(32).fill(0))).toThrow()
    })
})

describe('keychron/protocol — handshake (0xA0/0xA1)', () => {
    it('parses protocol version + qmk command set', () => {
        const cmd = getProtocolVersionCmd()
        expect(cmd[0]).toBe(0xa0)
        const resp = frame([0xa0, 0x02, 0x00, 0x02])
        const info = parseProtocolVersion(resp)
        expect(info.protocolVersion).toBe(0x02)
        expect(info.qmkCommandSet).toBe(0x02)
    })

    it('parses ASCII firmware version', () => {
        const cmd = getFirmwareVersionCmd()
        expect(cmd[0]).toBe(0xa1)
        const text = 'v1.2.3 2025-09-01'
        const bytes = [0xa1, ...text.split('').map((c) => c.charCodeAt(0))]
        const resp = frame(bytes)
        expect(parseFirmwareVersion(resp)).toBe(text)
    })

    it('throws on error response (0xFF/0x00)', () => {
        const resp = frame([0xff, 0x00])
        expect(() => parseProtocolVersion(resp)).toThrow(ProtocolError)
    })

    it('throws on id mismatch', () => {
        const resp = frame([0x42, 0x02])
        expect(() => parseProtocolVersion(resp)).toThrow(/0x42 != 0xa0/)
    })
})

describe('keychron/protocol — feature flags (0xA2)', () => {
    it('decodes K5-Max-style featLo (BLUETOOTH | P24G | DEFAULT_LAYER)', () => {
        expect(getSupportFeatureCmd()[0]).toBe(0xa2)
        // bit0 default_layer | bit1 bluetooth | bit2 p24g = 0b00000111 = 0x07
        const resp = frame([0xa2, 0x07, 0x00])
        const f = parseFeatureFlags(resp)
        expect(f.defaultLayer).toBe(true)
        expect(f.bluetooth).toBe(true)
        expect(f.p24g).toBe(true)
        expect(f.analogMatrix).toBe(false)
        expect(f.stateNotify).toBe(false)
        expect(f.keychronRgb).toBe(false)
        expect(f.nkro).toBe(false)
        expect(f.raw).toBe(0x0007)
    })

    it('decodes featHi NKRO bit', () => {
        // featHi bit1 = NKRO
        const resp = frame([0xa2, 0x00, 0x02])
        const f = parseFeatureFlags(resp)
        expect(f.nkro).toBe(true)
        expect(f.quickStart).toBe(false)
        expect(f.raw).toBe(0x0200)
    })

    it('decodes all flags set', () => {
        const resp = frame([0xa2, 0xff, 0x03])
        const f = parseFeatureFlags(resp)
        expect(f.defaultLayer && f.bluetooth && f.p24g && f.analogMatrix).toBe(
            true,
        )
        expect(f.stateNotify && f.dynamicDebounce && f.snapClick).toBe(true)
        expect(f.keychronRgb && f.quickStart && f.nkro).toBe(true)
    })
})

describe('keychron/protocol — default layer (0xA3)', () => {
    it('round-trips', () => {
        expect(getDefaultLayerCmd()[0]).toBe(0xa3)
        const resp = frame([0xa3, 0x02])
        expect(parseDefaultLayer(resp)).toBe(2)
    })
})

describe('keychron/protocol — misc proto (0xA7/0x01)', () => {
    it('decodes misc proto (LE16) + feature mask byte', () => {
        const cmd = getMiscProtocolVersionCmd()
        expect(cmd[0]).toBe(0xa7)
        expect(cmd[1]).toBe(0x01)
        // [0xA7, 0x01, 0, lo, hi, mask, ...]
        // miscProto = 0x0002 LE → lo=0x02 hi=0x00
        // mask: WIRELESS_LPM (bit4) | NKRO (bit7) = 0x90
        const resp = frame([0xa7, 0x01, 0x00, 0x02, 0x00, 0x90])
        const info = parseMiscProtocolVersion(resp)
        expect(info.miscProtocolVersion).toBe(0x0002)
        expect(info.miscFeatures.wirelessLpm).toBe(true)
        expect(info.miscFeatures.nkro).toBe(true)
        expect(info.miscFeatures.dfuInfo).toBe(false)
        expect(info.miscFeatures.language).toBe(false)
        expect(info.miscFeatures.raw).toBe(0x90)
    })

    it('uses LE byte order (not VIA-style BE)', () => {
        const resp = frame([0xa7, 0x01, 0x00, 0xcd, 0xab])
        expect(parseMiscProtocolVersion(resp).miscProtocolVersion).toBe(0xabcd)
    })
})

describe('keychron/protocol — wireless LPM (0xA7/0x0B-0x0C)', () => {
    it('get cmd has correct sub-byte', () => {
        const cmd = getWirelessLpmCmd()
        expect(cmd[0]).toBe(0xa7)
        expect(cmd[1]).toBe(0x0b)
    })

    it('parses get response', () => {
        // [0xA7, 0x0B, enabled, lo, hi, ...] → timeout LE16
        const resp = frame([0xa7, 0x0b, 0x01, 0xe8, 0x03])
        const cfg = parseWirelessLpm(resp)
        expect(cfg.enabled).toBe(true)
        expect(cfg.timeoutMs).toBe(1000)
    })

    it('builds set cmd', () => {
        const cmd = setWirelessLpmCmd({ enabled: false, timeoutMs: 500 })
        expect(cmd[0]).toBe(0xa7)
        expect(cmd[1]).toBe(0x0c)
        expect(cmd[2]).toBe(0)
        expect(cmd[3]).toBe(0xf4)
        expect(cmd[4]).toBe(0x01)
    })
})

describe('keychron/protocol — NKRO (0xA7/0x12-0x13)', () => {
    it('round-trips', () => {
        expect(getNkroCmd()[1]).toBe(0x12)
        expect(parseNkro(frame([0xa7, 0x12, 0x01]))).toBe(true)
        expect(parseNkro(frame([0xa7, 0x12, 0x00]))).toBe(false)
        expect(setNkroCmd(true)[1]).toBe(0x13)
        expect(setNkroCmd(true)[2]).toBe(1)
        expect(setNkroCmd(false)[2]).toBe(0)
    })
})

describe('keychron/protocol — factory reset (0xA7/0x11)', () => {
    it('builds cmd', () => {
        const cmd = factoryResetCmd()
        expect(cmd[0]).toBe(0xa7)
        expect(cmd[1]).toBe(0x11)
    })
})

describe('keychron/protocol — DFU info (0xA7/0x02)', () => {
    it('decodes module type + version', async () => {
        const { dfuModuleLabel, getDfuInfoCmd, parseDfuInfo } =
            await import('./protocol')
        const cmd = getDfuInfoCmd()
        expect(cmd[0]).toBe(0xa7)
        expect(cmd[1]).toBe(MISC_SUB.DFU_INFO_GET)
        const resp = frame([
            0xa7,
            MISC_SUB.DFU_INFO_GET,
            0x01,
            0x01,
            0x02,
            0x03,
        ])
        const info = parseDfuInfo(resp)
        expect(info.moduleType).toBe(1)
        expect(info.versionMajor).toBe(1)
        expect(info.versionMinor).toBe(2)
        expect(info.versionPatch).toBe(3)
        expect(dfuModuleLabel(info)).toBe('LKBT51 v1.2.3')
    })

    it('labels CKBT51', async () => {
        const { dfuModuleLabel, parseDfuInfo } = await import('./protocol')
        const resp = frame([
            0xa7,
            MISC_SUB.DFU_INFO_GET,
            0x02,
            0x00,
            0x09,
            0x00,
        ])
        expect(dfuModuleLabel(parseDfuInfo(resp))).toBe('CKBT51 v0.9.0')
    })
})

describe('keychron/protocol — RGB (0xA8)', () => {
    it('save cmd', () => {
        const cmd = rgbSaveCmd()
        expect(cmd[0]).toBe(0xa8)
        expect(cmd[1]).toBe(RGB_SUB.SAVE)
    })

    it('led-count round-trips', () => {
        expect(getLedCountCmd()[1]).toBe(RGB_SUB.GET_LED_COUNT)
        const resp = frame([0xa8, RGB_SUB.GET_LED_COUNT, 0x69])
        expect(parseLedCount(resp)).toBe(0x69)
    })
})
