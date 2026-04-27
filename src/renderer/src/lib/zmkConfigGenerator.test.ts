import { describe, it, expect } from 'vitest'
import {
    generateZMKKeymapFile,
    generateZMKConfigFile,
} from './zmkConfigGenerator'
import type { Keymap, Layer } from '@zmkfirmware/zmk-studio-ts-client/keymap'

const keyPress = { displayName: 'Key Press' }
const layerBehavior = { displayName: 'Layer' }
const transparent = { displayName: 'Transparent' }

const behaviorMap = {
    1: keyPress,
    2: layerBehavior,
    3: transparent,
} as never

const makeLayer = (id: number, bindings: unknown[]): Layer =>
    ({ id, bindings }) as Layer

const baseOptions = {
    keyboardName: 'Corne',
    keymapName: 'default',
    includeLayers: true,
}

describe('generateZMKKeymapFile', () => {
    it('renders header with keyboard + keymap name', () => {
        const km: Keymap = { layers: [makeLayer(0, [])] } as Keymap
        const out = generateZMKKeymapFile(km, behaviorMap, baseOptions)

        expect(out).toContain('// Generated ZMK keymap for Corne')
        expect(out).toContain('// Keymap: default')
    })

    it('emits #define entries when includeLayers true', () => {
        const km: Keymap = {
            layers: [makeLayer(10, []), makeLayer(20, [])],
        } as Keymap
        const out = generateZMKKeymapFile(km, behaviorMap, baseOptions)

        expect(out).toMatch(/#define L0 10/)
        expect(out).toMatch(/#define L1 20/)
    })

    it('omits #define section when includeLayers false', () => {
        const km: Keymap = { layers: [makeLayer(0, [])] } as Keymap
        const out = generateZMKKeymapFile(km, behaviorMap, {
            ...baseOptions,
            includeLayers: false,
        })

        expect(out).not.toContain('#define L0')
    })

    it('maps Key Press binding param1 to HID name (&kp A)', () => {
        const km: Keymap = {
            layers: [makeLayer(0, [{ behaviorId: 1, param1: 0x04 }])],
        } as Keymap
        const out = generateZMKKeymapFile(km, behaviorMap, baseOptions)
        expect(out).toContain('&kp A')
    })

    it('maps Layer binding to &mo with layer index', () => {
        const km: Keymap = {
            layers: [makeLayer(0, [{ behaviorId: 2, param1: 3 }])],
        } as Keymap
        const out = generateZMKKeymapFile(km, behaviorMap, baseOptions)
        expect(out).toContain('&mo 3')
    })

    it('maps Transparent to &trans', () => {
        const km: Keymap = {
            layers: [makeLayer(0, [{ behaviorId: 3, param1: 0 }])],
        } as Keymap
        const out = generateZMKKeymapFile(km, behaviorMap, baseOptions)
        expect(out).toContain('&trans')
    })

    it('falls back to UNKNOWN_<hex> for unmapped HID usages', () => {
        const km: Keymap = {
            layers: [makeLayer(0, [{ behaviorId: 1, param1: 0xff }])],
        } as Keymap
        const out = generateZMKKeymapFile(km, behaviorMap, baseOptions)
        expect(out).toContain('&kp UNKNOWN_ff')
    })

    it('puts comma between bindings but not after last one', () => {
        const km: Keymap = {
            layers: [
                makeLayer(0, [
                    { behaviorId: 1, param1: 0x04 },
                    { behaviorId: 1, param1: 0x05 },
                ]),
            ],
        } as Keymap
        const out = generateZMKKeymapFile(km, behaviorMap, baseOptions)

        // Two bindings → one comma between them
        const matches = out.match(/&kp [A-Z]+/g)
        expect(matches).toEqual(['&kp A', '&kp B'])
        expect(out).toContain('&kp A,')
        expect(out).not.toContain('&kp B,')
    })

    it('skips bindings whose behaviorId is not in BehaviorMap', () => {
        const km: Keymap = {
            layers: [
                makeLayer(0, [
                    { behaviorId: 1, param1: 0x04 },
                    { behaviorId: 999, param1: 0x05 },
                ]),
            ],
        } as Keymap
        const out = generateZMKKeymapFile(km, behaviorMap, baseOptions)
        expect(out).toContain('&kp A')
        expect(out).not.toContain('&kp B')
    })

    it('emits one layer block per layer', () => {
        const km: Keymap = {
            layers: [
                makeLayer(0, [{ behaviorId: 1, param1: 0x04 }]),
                makeLayer(1, [{ behaviorId: 1, param1: 0x05 }]),
            ],
        } as Keymap
        const out = generateZMKKeymapFile(km, behaviorMap, baseOptions)
        expect(out).toContain('layer_0 {')
        expect(out).toContain('layer_1 {')
        expect(out).toContain('label = "Layer 0"')
        expect(out).toContain('label = "Layer 1"')
    })
})

describe('generateZMKConfigFile', () => {
    it('embeds keyboard name in CONFIG_BT_DEVICE_NAME', () => {
        const out = generateZMKConfigFile({
            keyboardName: 'Lily58',
            keymapName: 'default',
        })
        expect(out).toContain('CONFIG_BT_DEVICE_NAME="Lily58"')
    })

    it('includes core CONFIG flags', () => {
        const out = generateZMKConfigFile({
            keyboardName: 'k',
            keymapName: 'k',
        })
        expect(out).toContain('CONFIG_BT=y')
        expect(out).toContain('CONFIG_ZMK_USB_LOGGING=y')
        expect(out).toContain('CONFIG_ZMK_BATTERY_REPORTING=y')
    })
})
