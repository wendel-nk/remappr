// pattern-check: skip — shared BLE UUID constants, no abstraction
// Default BLE UUIDs for the active firmware adapter. The values are the
// ZMK Studio service/characteristic UUIDs, but the shell layer should
// treat them as opaque identifiers supplied by the firmware adapter.
// Future phases route these per-adapter via IPC instead of the static
// constant.
export const STUDIO_SERVICE_UUID = '00000000-0196-6107-c967-c5cfb1c2482a'
export const STUDIO_CHAR_UUID = '00000001-0196-6107-c967-c5cfb1c2482a'

export const STUDIO_SERVICE_UUID_NOBLE = STUDIO_SERVICE_UUID.replace(
    /-/g,
    '',
).toLowerCase()
export const STUDIO_CHAR_UUID_NOBLE = STUDIO_CHAR_UUID.replace(
    /-/g,
    '',
).toLowerCase()
