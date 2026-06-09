# Advanced features

On a connected device, Remappr exposes the firmware's advanced behaviors and
hardware settings — each **capability-gated**, so a panel only appears when the
board actually supports it.

::: info 📷 Screenshot slot — `docs/public/images/editor/advanced-sheet.png`
The Advanced sheet with its tabs (Tap Dance · Combo · Key Override · Alt Repeat ·
Macros).
:::

## The Advanced sheet

Opened from the header (**Dynamic Entries** ⇄ or **Macros** ✦). Tabs appear only
when the device advertises that capability:

| Tab              | Shown when             | Edits                                                   |
| ---------------- | ---------------------- | ------------------------------------------------------- |
| **Tap Dance**    | tap-dance count > 0    | Multi-tap behaviors (tap / hold actions, tapping term). |
| **Combo**        | combo count > 0        | Key chords → output.                                    |
| **Key Override** | key-override count > 0 | Remap rules with activation options.                    |
| **Alt Repeat**   | supported              | Alternate-repeat-key.                                   |
| **Macros**       | macro count > 0        | Tap / down / up / delay / text sequences.               |

These map to the same concepts as the config's
[`tapDances`](/reference/config/keymap-format#tapdances),
[`macros`](/reference/config/keymap-format#macros) and
[`combos`](/reference/config/keymap-format#combos) — here you edit them live on
the device (mostly VIA/Vial/Keychron).

## Wireless settings

The **Wireless** button (📶) opens _"Wireless Settings — Power, NKRO &
connection"_:

- **Status** — transport (`usb`/`ble`), BT slot, battery level / charging,
  wireless module.
- **Low-power mode** — **Enable LPM**, **Timeout (ms)**, **Save LPM**.
- **N-Key Rollover** — **Enable NKRO**.
- **Danger zone** — **Factory reset** (_"Reset all settings to factory defaults?
  This cannot be undone."_).

## Advanced Mode

The **Advanced Mode** button (ⓘ) opens _"Advanced Mode — Debounce, report rate &
key behaviour"_:

- **Debounce** — **Response time** slider (0–80 ms) + raw **Mode**, **Save
  debounce**.
- **Report rate** — raw **Value**, **Save report rate**.
- **Snap-click** — **Enable snap-click (rapid trigger)**.
- **N-Key Rollover** — **Enable NKRO**.
- **Quick Start** — note that auto-sleep / auto-backlight-off live in the
  Wireless panel.

## Device controls

- **Bluetooth profiles** — manage BT connection slots (ZMK / Keychron).
- **Lock / unlock** — see [Connecting a device](/guide/app/connecting#unlocking).
- **Restore Stock Settings** — from the device menu, resets to the stock keymap.

## See also

- [The keymap editor](/guide/editor)
- [Firmware targets & capabilities](/reference/config/firmware-targets)
