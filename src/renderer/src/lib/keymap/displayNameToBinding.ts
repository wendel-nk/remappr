// Pattern check: no GoF pattern (-) — rejected — simple lookup table for ZMK binding prefix mapping, no abstraction warranted.
const BINDING_MAP: Record<string, string> = {
    'Key Press': '&kp',
    Modifier: '&kp',
    Layer: '&mo',
    'Layer (Momentary)': '&mo',
    'Momentary Layer': '&mo',
    'Layer-Tap': '&lt',
    'Mod-Tap': '&mt',
    'Sticky Key': '&sk',
    'Sticky Layer': '&sl',
    'To Layer': '&to',
    'Toggle Layer': '&tog',
    Transparent: '&trans',
    None: '&none',
    Bluetooth: '&bt',
    Reset: '&sys_reset',
    'System Reset': '&sys_reset',
    Bootloader: '&bootloader',
}

export function displayNameToBinding(displayName: string): string {
    if (!displayName) return ''
    if (BINDING_MAP[displayName]) return BINDING_MAP[displayName]
    const slug = displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
    return slug ? `&${slug}` : ''
}
