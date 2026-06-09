# Hardware

These objects live under `keyboard` and describe the _physical board_ — enough
for a compiler to emit a flashable project instead of just scaffolding. All of
them are **optional**: a keymap-only config (no controller, no wiring) is still
valid; it just exports as a checklist for you to fill in.

[[toc]]

## Matrix {#matrix}

`keyboard.matrix` — the board-level matrix descriptor (the friendly summary; the
per-key `[row, col]` lives on each key in
[`keyboard.keys`](/reference/config/keymap-format#keyboard)).

| Field            | Type                       | Notes                                    |
| ---------------- | -------------------------- | ---------------------------------------- |
| `rows`           | number · required          |                                          |
| `cols`           | number · required          |                                          |
| `diodeDirection` | `"row2col"` \| `"col2row"` |                                          |
| `mode`           | `"matrix"` \| `"direct"`   | Row/col GPIO matrix vs one GPIO per key. |

`keyboard.pins` carries friendly per-row/col GPIO **labels** (e.g. `"GP4"`) shown
in the builder — `{ rows: string[], cols: string[] }`, index-aligned to the
transform. These are builder metadata kept separate from the real kscan wiring so
editing a label can never corrupt the electrical definition; each compiler maps
them to its firmware's pin syntax.

### Pin label resolution

A friendly silkscreen label is resolved to the firmware's pin token per
controller:

| Board family                                      | Example label | ZMK resolves to | QMK resolves to        |
| ------------------------------------------------- | ------------- | --------------- | ---------------------- |
| Pro-Micro footprint (`nice_nano_v2`, `pro_micro`) | `D4`          | `&pro_micro 4`  | `D4` (AVR alias table) |
| Seeed Xiao (`seeeduino_xiao_ble`)                 | `D3`          | `&xiao_d 3`     | `D3`                   |
| RP2040 (`rp2040`, `rpi_pico`)                     | `GP29`        | `&gpio0 29`     | `GP29`                 |

Boards with a known table (`nice_nano_v2`, `pro_micro`,
`sparkfun_pro_micro_rp2040`, `seeeduino_xiao_ble`, `seeeduino_xiao_rp2040`,
`rp2040`, `rpi_pico`) emit a real kscan. An unknown board still works — it emits a
"fill the GpioSpec" comment instead of a resolved spec. ZMK then composes role
flags: input side `(GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)`, output side
`GPIO_ACTIVE_HIGH`, direct switches `(GPIO_ACTIVE_LOW | GPIO_PULL_UP)`.

## Controller {#controller}

`keyboard.controller` — the MCU identity for a real build.

| Field              | Type   | Used by   | Notes                                                              |
| ------------------ | ------ | --------- | ------------------------------------------------------------------ |
| `board`            | string | ZMK / QMK | ZMK Zephyr board (e.g. `nice_nano_v2`), or QMK board support-file. |
| `shield`           | string | ZMK       | When the keymap is a shield on a controller board.                 |
| `processor`        | string | QMK       | MCU family, e.g. `atmega32u4`, `STM32F103`, `RP2040`.              |
| `bootloader`       | string | QMK       | e.g. `atmel-dfu`, `rp2040`, `uf2boot`.                             |
| `developmentBoard` | string | QMK       | Shortcut that sets processor+bootloader+board (e.g. `promicro`).   |
| `deviceVersion`    | string | QMK       | USB bcdDevice, e.g. `"1.0.0"`.                                     |

::: tip
ZMK needs a `board` (+ optional `shield`). The QMK family needs either a
`developmentBoard`, or both `processor` and `bootloader`. The
[readiness check](/guide/builder/export-build-flash#readiness) enforces this.
:::

## kscan & matrix-transform

`keyboard.hardware` holds the real electrical wiring. When present these
**replace** the geometry-derived scaffold the compiler would otherwise emit.

### `hardware.kscan`

One of two shapes:

**Matrix** (`zmk,kscan-gpio-matrix`):

| Field                                  | Type                                  | Notes |
| -------------------------------------- | ------------------------------------- | ----- |
| `type`                                 | `"matrix"` · required                 |       |
| `diodeDirection`                       | `"row2col"` \| `"col2row"` · required |       |
| `rowGpios`                             | `GpioSpec[]` · required               |       |
| `colGpios`                             | `GpioSpec[]` · required               |       |
| `debouncePressMs`, `debounceReleaseMs` | number                                |       |

**Direct** (`zmk,kscan-gpio-direct`, one GPIO per key):

| Field                                  | Type                    | Notes |
| -------------------------------------- | ----------------------- | ----- |
| `type`                                 | `"direct"` · required   |       |
| `inputGpios`                           | `GpioSpec[]` · required |       |
| `debouncePressMs`, `debounceReleaseMs` | number                  |       |

A **`GpioSpec`** is a raw devicetree phandle+specifier stored verbatim, e.g.
`"&gpio0 4 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)"`. Remappr does not model SoC
pin-mux; the builder composes these strings and the compiler emits them unchanged.

### `hardware.transform`

The real `zmk,matrix-transform` — one `[row, col]` per physical key, in keymap
binding order. When present it is authoritative.

| Field     | Type                                        |
| --------- | ------------------------------------------- |
| `rows`    | number                                      |
| `columns` | number                                      |
| `map`     | `[row, col][]` (one per key, binding order) |

## Lighting hardware {#lighting-hardware}

Driving real LEDs from a ZMK export needs the peripheral described under
`keyboard.hardware`.

### `hardware.backlightPwm` (single-color PWM)

| Field      | Type              | Notes                                                     |
| ---------- | ----------------- | --------------------------------------------------------- |
| `instance` | string · required | PWM controller phandle label, e.g. `"pwm0"`.              |
| `channel`  | number · required | PWM channel index.                                        |
| `pin`      | string · required | LED pin — nRF label `"P0.13"` or a verbatim psels string. |
| `inverted` | boolean           | Active-low LED → inverted polarity.                       |
| `periodMs` | number            | PWM period, default 10.                                   |

### `hardware.ws2812` (addressable RGB strip)

| Field             | Type                                | Notes                                                |
| ----------------- | ----------------------------------- | ---------------------------------------------------- |
| `spi`             | string · required                   | SPI controller phandle label, e.g. `"spi3"`.         |
| `dataPin`         | string · required                   | MOSI/data pin — nRF label `"P1.13"` or psels string. |
| `chainLength`     | number · required                   | LEDs in the chain.                                   |
| `colorOrder`      | `GRB`\|`RGB`\|`BGR`\|`RGBW`\|`GRBW` | Default `GRB`.                                       |
| `spiMaxFrequency` | number                              | SPI bit clock (Hz), default 4 000 000.               |

### `hardware.extPowerCtrl` (peripheral power gate)

| Field         | Type              | Notes                                         |
| ------------- | ----------------- | --------------------------------------------- |
| `controlGpio` | string · required | Control GPIO — nRF label or `&gpio0 14` core. |
| `activeLow`   | boolean           |                                               |
| `initDelayMs` | number            | Settle time after enable, default 0.          |

### Board-level lighting config

`keyboard.lighting` records the board's default lighting (additive / export-only
for now — distinct from [`lighting` actions](/reference/config/actions#lighting)):

- `underglow`: `{ effect?, hue? (0–360), brightness? (0–100) }`
- `backlight`: `{ brightness? (0–100), breathing? }`

## Firmware config {#firmware-config}

`keyboard.firmwareConfig` — the modeled feature toggles that derive the ZMK
`.conf` (Kconfig) / QMK `config.h` + `rules.mk`. Every boolean is **tri-state**:
`undefined` = auto-derive from used behaviors + hardware; explicit `true`/`false`
= your override.

| Field           | Derives                        | Default                                  |
| --------------- | ------------------------------ | ---------------------------------------- |
| `usb`           | `CONFIG_ZMK_USB`               | on                                       |
| `ble`           | `CONFIG_ZMK_BLE`               | off (opt-in for wireless)                |
| `studio`        | `CONFIG_ZMK_STUDIO`            | on                                       |
| `studioLocking` | `CONFIG_ZMK_STUDIO_LOCKING`    | on                                       |
| `studioUsbCdc`  | Studio-over-USB CDC block      | follows `studio`                         |
| `softOff`       | `CONFIG_ZMK_PM_SOFT_OFF`       | = a `soft_off` behavior is used          |
| `extPower`      | `CONFIG_ZMK_EXT_POWER`         | = `ext_power` used or `extPowerCtrl` set |
| `pointing`      | `CONFIG_ZMK_POINTING`          | = a mouse behavior is used               |
| `backlight`     | `CONFIG_ZMK_BACKLIGHT` (+ PWM) | = backlight used or `backlightPwm` set   |
| `underglow`     | `CONFIG_ZMK_RGB_UNDERGLOW`     | = underglow used or `ws2812` set         |
| `usbLogging`    | `CONFIG_ZMK_USB_LOGGING`       | off                                      |

Free-text escape hatches, appended verbatim: `kconfig` (extra ZMK `.conf`
lines), `configH` (extra QMK `#define`s), `rulesMk` (extra QMK make assignments).

### Generated config files

The resolved flags become real files in the [export bundle](/guide/builder/export-build-flash).
A ZMK `.conf` derived from the demo (toggles auto-derived from used behaviors +
hardware; an off feature is commented as a hint):

```ini
# ZMK config for My Split
# Generated by remappr — toggles derive from your behaviors + hardware.

# ── Transports ──
CONFIG_ZMK_USB=y
CONFIG_ZMK_BLE=y

# ── ZMK Studio ──
CONFIG_ZMK_STUDIO=y
CONFIG_ZMK_STUDIO_LOCKING=y

# CONFIG_ZMK_BACKLIGHT=y
CONFIG_ZMK_RGB_UNDERGLOW=y

# ── Optional ──
# CONFIG_ZMK_USB_LOGGING=y
```

The QMK family gets a `config.h` (board overrides; pins/MCU/USB are data-driven in
`keyboard.json`) and a `rules.mk` (`VIA_ENABLE = yes` / `VIAL_ENABLE = yes` when
those targets are selected). Your `firmwareConfig.kconfig` / `configH` / `rulesMk`
extras are appended verbatim under an "Extra (from builder)" header.

## Vial security {#vial}

`keyboard.vial` — Vial refuses to expose its keymap to the GUI until unlocked.
Emitted to the Vial keymap's `config.h`.

| Field        | Type           | Notes                                                 |
| ------------ | -------------- | ----------------------------------------------------- |
| `uid`        | number[]       | 8-byte keyboard UID (each 0–255).                     |
| `unlockKeys` | `[row, col][]` | Unlock combo — matrix positions held together.        |
| `insecure`   | boolean        | Build with `VIAL_INSECURE` — no unlock (dev/testing). |

## Layout variants

- `keyboard.layouts` — named physical-layout variants (`{ id, name }`); keys tag
  in via `CanonGeometry.variant`.
- `keyboard.layoutOptions` — VIA/Vial layout options (`{ label, choices? }`);
  ≥2 choices makes a dropdown, else a boolean toggle. Keys reference an option by
  index via `CanonGeometry.option = [group, choice]`.

## See also

- [Identity & hardware (builder guide)](/guide/builder/identity-and-hardware)
- [Firmware targets & capabilities](/reference/config/firmware-targets)
