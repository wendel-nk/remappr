# RGB & lighting

On a connected device, the **RGB lighting** button (💡) in the header opens the
**RGB sheet** — a bottom dock for editing the board's lighting live. It is
**disabled on ZMK** (no runtime RGB protocol — _"RGB lighting not supported on
ZMK"_); use [lighting actions](/reference/config/actions#lighting) there instead.

::: info 📷 Screenshot slot — `docs/public/images/editor/rgb-sheet.png`
The RGB sheet with the **Per-key RGB** tab active and keys selected for painting.
:::

## Tabs

| Tab                 | What it does                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| **Backlight**       | Single-color backlight brightness/effect.                                                      |
| **Per-key RGB**     | Paint per-switch colors directly onto keys.                                                    |
| **Mix RGB**         | _"Split the keyboard into two zones, each with its own looping effect timeline. Coming soon."_ |
| **Underglow**       | Underglow strip control.                                                                       |
| **Indicator Light** | Status indicator LED.                                                                          |
| **Advanced**        | Lower-level RGB controls.                                                                      |

## Per-key painting

In **Per-key RGB**, click keys on the board to select them (multi-select for
batch coloring), pick a color, and it writes to the device's LED map. While
painting, the binding picker is suppressed so clicks select LEDs, not bindings.

## Saving

The sheet's **Save** button commits RGB settings to the keyboard (_"RGB settings
saved to keyboard"_). It only appears on a real device with an RGB service — in
the simulator there is nothing to persist to.

## See also

- [Builder lighting](/guide/builder/lighting) — declaring lighting on a design
- [`lighting` action](/reference/config/actions#lighting) — keymap-bound controls
  (the ZMK path)
