# Identity & hardware

The **Identity** panel holds everything about the board that is not its layout or
bindings — name, USB identity, firmware targets, controller, matrix, lighting and
firmware config. These fields turn a keymap into a _flashable_ project. Sections
appear/disappear based on the firmware targets you select.

::: info 📷 Screenshot slot — `docs/public/images/builder/identity.png`
The Identity panel scrolled to show **Identity**, **USB identifiers**,
**Firmware targets** and **Controller**.
:::

Every field below is labelled exactly as it appears in the panel, with the
config key it writes.

## Identity

| Field                   | Writes        | Notes                                               |
| ----------------------- | ------------- | --------------------------------------------------- |
| **Keyboard name**       | `meta.name`   | Display name; seeds the export project/shield name. |
| **Author / maintainer** | `meta.author` |                                                     |

## USB identifiers

| Field          | Writes           | Placeholder |
| -------------- | ---------------- | ----------- |
| **Vendor ID**  | `meta.vendorId`  | `0xFEED`    |
| **Product ID** | `meta.productId` | `0x0001`    |

Required for the QMK family.

## Firmware targets

Cards for each target (**QMK**, **VIA**, **Vial**, **ZMK**) with a one-line
blurb; selecting them fills `keyboard.firmware[]`. An info line summarises the
choice — _"Keyboard type · Wired (USB)"_ or _"Wireless (BLE)"_, and _"Keycodes &
behaviours follow {firmware}"_. VIA and Vial compile through QMK. See
[Firmware targets](/reference/config/firmware-targets).

## Controller

Writes `keyboard.controller`. Fields shown depend on the targets:

| Field                | Writes                        | Placeholder    | For       |
| -------------------- | ----------------------------- | -------------- | --------- |
| **Board**            | `controller.board`            | `nice_nano_v2` | ZMK / QMK |
| **Shield (opt.)**    | `controller.shield`           | `corne_left`   | ZMK       |
| **Processor (QMK)**  | `controller.processor`        | `atmega32u4`   | QMK       |
| **Bootloader (QMK)** | `controller.bootloader`       | `atmel-dfu`    | QMK       |
| **Dev board (QMK)**  | `controller.developmentBoard` | `promicro`     | QMK       |
| **Device version**   | `controller.deviceVersion`    | `1.0.0`        | QMK       |

> _"ZMK uses board + optional shield. QMK uses processor + bootloader (or a
> dev-board shortcut) + USB device version."_

## Matrix

The board-level matrix descriptor (`keyboard.matrix`) plus pin labels
(`keyboard.pins`):

| Control             | Writes                    | Options                                                   |
| ------------------- | ------------------------- | --------------------------------------------------------- |
| **Diode direction** | `matrix.diodeDirection`   | `COL2ROW` / `ROW2COL`                                     |
| **Scan mode**       | `matrix.mode`             | Matrix (row × col) / Direct (1 GPIO/key)                  |
| **Pin mapping**     | `pins.rows` / `pins.cols` | `row pins` / `col pins`                                   |
| **Auto**            | per-key `matrix`          | _"Auto assigns each key's row/column from its position."_ |

The display reads e.g. `4 × 12 · 36 keys` (`· wired` when keys have matrix
positions). Per-key wiring is in the [inspector](/guide/builder/inspector#matrix-wiring-row-column).

## Capabilities

| Toggle                | Writes           |
| --------------------- | ---------------- |
| **Split / two-piece** | `keyboard.split` |

## Lighting

Writes `keyboard.lighting`; _"Configured for every firmware target — the exporter
maps it to each platform."_

| Control                    | Writes                                                            |
| -------------------------- | ----------------------------------------------------------------- |
| **RGB underglow**          | `lighting.underglow` (on)                                         |
| — **Effect**               | `underglow.effect` — solid / breathe / rainbow / swirl / gradient |
| — **Color**                | `underglow.hue` (or Rainbow)                                      |
| — **Brightness**           | `underglow.brightness`                                            |
| **Per-key backlight**      | `lighting.backlight` (on)                                         |
| — **Backlight brightness** | `backlight.brightness`                                            |
| — **Breathing**            | `backlight.breathing`                                             |

See [Lighting](/guide/builder/lighting) for the full picture (actions vs config).

## Firmware config (.conf) — ZMK

Toggles that derive the ZMK `.conf`, writing `keyboard.firmwareConfig`. A live
**Generated .conf** preview updates as you flip them. **Extra Kconfig** (e.g.
`CONFIG_ZMK_SLEEP=y`) is appended verbatim.

| Toggle                     | Derives                     |
| -------------------------- | --------------------------- |
| **USB**                    | `CONFIG_ZMK_USB`            |
| **Bluetooth (BLE)**        | `CONFIG_ZMK_BLE`            |
| **ZMK Studio**             | `CONFIG_ZMK_STUDIO`         |
| **Studio over USB (CDC)**  | Studio CDC block            |
| **Studio unlock required** | `CONFIG_ZMK_STUDIO_LOCKING` |
| **Soft-off**               | `CONFIG_ZMK_PM_SOFT_OFF`    |
| **External power**         | `CONFIG_ZMK_EXT_POWER`      |
| **Pointing (mouse)**       | `CONFIG_ZMK_POINTING`       |
| **USB logging**            | `CONFIG_ZMK_USB_LOGGING`    |

Each is **tri-state** — left alone it auto-derives from used behaviors/hardware;
toggling sets an explicit override. See
[Firmware config](/reference/config/hardware#firmware-config).

## Hardware pins — ZMK

Appears when a feature needs a pin. Friendly nRF labels like `P0.13` emit psels;
_"verify against your board wiring."_ Writes `keyboard.hardware`.

| Section                    | Fields                                                     | Writes                  |
| -------------------------- | ---------------------------------------------------------- | ----------------------- |
| **Ext-power control GPIO** | pin (`P0.14`), **Active low**                              | `hardware.extPowerCtrl` |
| **Backlight PWM**          | pin (`P0.13`), instance (`pwm0`), **Inverted**             | `hardware.backlightPwm` |
| **WS2812 underglow**       | data pin (`P1.13`), LEDs, color order (GRB…), SPI (`spi3`) | `hardware.ws2812`       |

## Firmware config (config.h / rules.mk) — QMK

For the QMK family: **Extra config.h** (`#define TAPPING_TERM 180`) and **Extra
rules.mk** (`MOUSEKEY_ENABLE = yes`), each with a live **Generated** preview.
Writes `firmwareConfig.configH` / `firmwareConfig.rulesMk`.

## Vial security

Shown when **Vial** is a target. Writes `keyboard.vial`:

| Control                                         | Writes            |
| ----------------------------------------------- | ----------------- |
| **Keyboard UID (8 bytes)** + **Generate**       | `vial.uid`        |
| **Unlock combo (row,col …)** + **Add selected** | `vial.unlockKeys` |
| **Insecure (no unlock required)**               | `vial.insecure`   |

> _"Vial ties a flashed board to its definition by UID and locks the keymap until
> the unlock keys are held. Select keys on the board, then 'Add selected'."_

## Layout options

Shown for VIA/Vial. Writes `keyboard.layoutOptions`; keys tag in via the
inspector's **Layout variant**.

- **Option label** + **Choices, comma-separated (blank = toggle)** → **Add
  option**. _"A blank choices field is an on/off toggle; two or more choices make
  a dropdown."_
- Per-option **Tag → {choice}** and **Untag selected** tag the current selection.

## Readiness

A live **Readiness** strip shows a button per target — green/_"Ready to build"_
when there are no blocking errors, otherwise a tooltip lists what is missing. This
is the same check the [export modal](/guide/builder/export-build-flash#readiness)
runs.

## A filled-in example

```json
"meta": { "name": "My Split", "vendorId": "0xFEED", "productId": "0x0001", "target": null },
"keyboard": {
  "id": "my_split",
  "name": "My Split",
  "firmware": ["zmk"],
  "controller": { "board": "nice_nano_v2", "shield": "my_split_left" },
  "matrix": { "rows": 4, "cols": 6, "diodeDirection": "col2row", "mode": "matrix" },
  "split": true,
  "firmwareConfig": { "ble": true, "studio": true }
}
```

## Next

[Lighting →](/guide/builder/lighting)
