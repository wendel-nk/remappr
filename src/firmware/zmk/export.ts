// pattern-check: skip mechanical port — generator now consumes neutral Keymap, reads ZMK binding via zmkBindingFromAction helper
import type { Keymap } from '@firmware/types'
import type { BehaviorMap } from './actions'
import { zmkBindingFromAction } from './actions'
import { displayNameToBinding } from './displayNameToBinding'

export interface ZMKConfigOptions {
    keyboardName: string
    keymapName: string
    includeBehaviors?: boolean
    includeLayers?: boolean
}

export function generateZMKKeymapFile(
    keymap: Keymap,
    behaviors: BehaviorMap,
    options: ZMKConfigOptions,
): string {
    let config = `// Generated ZMK keymap for ${options.keyboardName}\n`
    config += `// Keymap: ${options.keymapName}\n\n`

    if (keymap.layers && options.includeLayers) {
        config += `// Layer definitions\n`
        keymap.layers.forEach((layer, index) => {
            config += `#define L${index} ${layer.id}\n`
        })
        config += `\n`
    }

    config += `// Keymap bindings\n`
    config += `keymap {\n`
    config += `    compatible = "zmk,keymap";\n\n`

    keymap.layers.forEach((layer, layerIndex) => {
        config += `    layer_${layerIndex} {\n`
        config += `        label = "Layer ${layerIndex}";\n`
        config += `        bindings = <\n`

        layer.keys.forEach((action, keyIndex) => {
            const binding = zmkBindingFromAction(action)
            const behavior = behaviors[binding.behaviorId]
            if (behavior) {
                const keyCode = generateKeyCode(binding, behavior)
                config += `            ${keyCode}`
                if (keyIndex < layer.keys.length - 1) {
                    config += `,`
                }
                config += `\n`
            }
        })

        config += `        >;\n`
        config += `    };\n\n`
    })

    config += `};\n`

    return config
}

export function generateZMKConfigFile(options: ZMKConfigOptions): string {
    let config = `// Generated ZMK configuration for ${options.keyboardName}\n`
    config += `// Configuration: ${options.keymapName}\n\n`

    // Basic configuration
    config += `// Enable USB logging\n`
    config += `CONFIG_ZMK_USB_LOGGING=y\n\n`

    config += `// Enable Bluetooth\n`
    config += `CONFIG_BT=y\n`
    config += `CONFIG_BT_PERIPHERAL=y\n`
    config += `CONFIG_BT_DEVICE_NAME="${options.keyboardName}"\n\n`

    config += `// Enable battery reporting\n`
    config += `CONFIG_ZMK_BATTERY_REPORTING=y\n`
    config += `CONFIG_ZMK_BATTERY_REPORT_INTERVAL=60000\n\n`

    config += `// Enable RGB underglow (if supported)\n`
    config += `CONFIG_ZMK_RGB_UNDERGLOW=y\n`
    config += `CONFIG_WS2812_STRIP=y\n\n`

    config += `// Enable combos\n`
    config += `CONFIG_ZMK_COMBO_MAX_COMBOS_PER_KEY=6\n`
    config += `CONFIG_ZMK_COMBO_MAX_KEYS_PER_COMBO=4\n\n`

    return config
}

function generateKeyCode(
    binding: { param1: number; param2?: number },
    behavior: { displayName: string },
): string {
    const prefix = displayNameToBinding(behavior.displayName)
    switch (behavior.displayName) {
        case 'Modifier':
            return `${prefix} ${getModifierName(binding.param1)}`
        case 'Layer':
            return `${prefix} ${binding.param1}`
        case 'Transparent':
        case 'None':
            return prefix
        case 'Key Press':
        default:
            return `${prefix} ${getHIDUsageName(binding.param1)}`
    }
}

function getHIDUsageName(hidUsage: number): string {
    // Map HID usage codes to ZMK key names
    const hidMap: Record<number, string> = {
        0x04: 'A',
        0x05: 'B',
        0x06: 'C',
        0x07: 'D',
        0x08: 'E',
        0x09: 'F',
        0x0a: 'G',
        0x0b: 'H',
        0x0c: 'I',
        0x0d: 'J',
        0x0e: 'K',
        0x0f: 'L',
        0x10: 'M',
        0x11: 'N',
        0x12: 'O',
        0x13: 'P',
        0x14: 'Q',
        0x15: 'R',
        0x16: 'S',
        0x17: 'T',
        0x18: 'U',
        0x19: 'V',
        0x1a: 'W',
        0x1b: 'X',
        0x1c: 'Y',
        0x1d: 'Z',
        0x1e: 'N1',
        0x1f: 'N2',
        0x20: 'N3',
        0x21: 'N4',
        0x22: 'N5',
        0x23: 'N6',
        0x24: 'N7',
        0x25: 'N8',
        0x26: 'N9',
        0x27: 'N0',
        0x28: 'ENTER',
        0x29: 'ESCAPE',
        0x2a: 'BACKSPACE',
        0x2b: 'TAB',
        0x2c: 'SPACE',
        0x2d: 'MINUS',
        0x2e: 'EQUAL',
        0x2f: 'LEFTBRACE',
        0x30: 'RIGHTBRACE',
        0x31: 'BACKSLASH',
        0x32: 'HASH',
        0x33: 'SEMICOLON',
        0x34: 'APOSTROPHE',
        0x35: 'GRAVE',
        0x36: 'COMMA',
        0x37: 'DOT',
        0x38: 'SLASH',
        0x39: 'CAPSLOCK',
        0x3a: 'F1',
        0x3b: 'F2',
        0x3c: 'F3',
        0x3d: 'F4',
        0x3e: 'F5',
        0x3f: 'F6',
        0x40: 'F7',
        0x41: 'F8',
        0x42: 'F9',
        0x43: 'F10',
        0x44: 'F11',
        0x45: 'F12',
        0x46: 'PRINT',
        0x47: 'SCROLLLOCK',
        0x48: 'PAUSE',
        0x49: 'INSERT',
        0x4a: 'HOME',
        0x4b: 'PAGEUP',
        0x4c: 'DELETE',
        0x4d: 'END',
        0x4e: 'PAGEDOWN',
        0x4f: 'RIGHT',
        0x50: 'LEFT',
        0x51: 'DOWN',
        0x52: 'UP',
        0x53: 'NUMLOCK',
        0x54: 'KPSLASH',
        0x55: 'KPASTERISK',
        0x56: 'KPMINUS',
        0x57: 'KPPLUS',
        0x58: 'KPENTER',
        0x59: 'KP1',
        0x5a: 'KP2',
        0x5b: 'KP3',
        0x5c: 'KP4',
        0x5d: 'KP5',
        0x5e: 'KP6',
        0x5f: 'KP7',
        0x60: 'KP8',
        0x61: 'KP9',
        0x62: 'KP0',
        0x63: 'KPDOT',
        0x64: 'NONUSBACKSLASH',
        0x65: 'COMPOSE',
        0x66: 'POWER',
        0x67: 'KPEQUAL',
        0x68: 'F13',
        0x69: 'F14',
        0x6a: 'F15',
        0x6b: 'F16',
        0x6c: 'F17',
        0x6d: 'F18',
        0x6e: 'F19',
        0x6f: 'F20',
        0x70: 'F21',
        0x71: 'F22',
        0x72: 'F23',
        0x73: 'F24',
        0x74: 'OPEN',
        0x75: 'HELP',
        0x76: 'PROPS',
        0x77: 'FRONT',
        0x78: 'STOP',
        0x79: 'AGAIN',
        0x7a: 'UNDO',
        0x7b: 'CUT',
        0x7c: 'COPY',
        0x7d: 'PASTE',
        0x7e: 'FIND',
        0x7f: 'MUTE',
        0x80: 'VOLUMEUP',
        0x81: 'VOLUMEDOWN',
        0x82: 'LOCKINGCAPSLOCK',
        0x83: 'LOCKINGNUMLOCK',
        0x84: 'LOCKINGSCROLLLOCK',
        0x85: 'KPCOMMA',
        0x86: 'EQUAL',
        0x87: 'RO',
        0x88: 'KATAKANAHIRAGANA',
        0x89: 'YEN',
        0x8a: 'HENKAN',
        0x8b: 'MUHENKAN',
        0x8c: 'KPJPCOMMA',
        0x8d: 'HANGEUL',
        0x8e: 'HANJA',
        0x8f: 'KATAKANA',
        0x90: 'HIRAGANA',
        0x91: 'ZENKAKUHANKAKU',
        0x92: 'KPLEFTPAREN',
        0x93: 'KPRIGHTPAREN',
        0x94: 'LEFTCTRL',
        0x95: 'LEFTSHIFT',
        0x96: 'LEFTALT',
        0x97: 'LEFTMETA',
        0x98: 'RIGHTCTRL',
        0x99: 'RIGHTSHIFT',
        0x9a: 'RIGHTALT',
        0x9b: 'RIGHTMETA',
        0x9c: 'MEDIAPLAYPAUSE',
        0x9d: 'MEDIASTOPCD',
        0x9e: 'MEDIAPREVIOUSSONG',
        0x9f: 'MEDIANEXTSONG',
        0xa0: 'MEDIAEJECTCD',
        0xa1: 'VOLUMEUP',
        0xa2: 'VOLUMEDOWN',
        0xa3: 'MUTE',
        0xa4: 'WWW',
        0xa5: 'BACK',
        0xa6: 'FORWARD',
        0xa7: 'STOP',
        0xa8: 'FIND',
        0xa9: 'SCROLLUP',
        0xaa: 'SCROLLDOWN',
        0xab: 'EDIT',
        0xac: 'SLEEP',
        0xad: 'COFFEE',
        0xae: 'REFRESH',
        0xaf: 'CALC',
    }

    return hidMap[hidUsage] || `UNKNOWN_${hidUsage.toString(16)}`
}

function getModifierName(modifier: number): string {
    const modifierMap: Record<number, string> = {
        0x01: 'LEFTCTRL',
        0x02: 'LEFTSHIFT',
        0x04: 'LEFTALT',
        0x08: 'LEFTMETA',
        0x10: 'RIGHTCTRL',
        0x20: 'RIGHTSHIFT',
        0x40: 'RIGHTALT',
        0x80: 'RIGHTMETA',
    }

    return modifierMap[modifier] || `MOD_${modifier.toString(16)}`
}

export function downloadConfigFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export function downloadConfigZip(
    keymapContent: string,
    configContent: string,
    keyboardName: string,
): void {
    // For now, we'll download the files separately
    // In a full implementation, you'd use a library like JSZip to create a zip file
    downloadConfigFile(keymapContent, `${keyboardName}.keymap`)
    setTimeout(() => {
        downloadConfigFile(configContent, `${keyboardName}.conf`)
    }, 100)
}
