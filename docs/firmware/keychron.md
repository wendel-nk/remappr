# Keychron QMK adapter

Studio detects Keychron QMK boards (VID `0x3434`) over USB Raw HID. The
adapter wins the probe race against the generic `qmk-via` adapter via VID
filter + `0xA0` handshake; if probe fails Studio falls back to `qmk-via`.

Implemented surface:

- Keymap r/w through stock VIA codecs (no Keychron-specific keymap wire).
- Capabilities populated from `0xA2` feature bitmap + `0xA7/0x01` misc mask.
- `WirelessApi` facade — LPM get/set, NKRO get/set, factory-reset, status
  via state-notify.
- `RgbApi` facade — LED count, indicators get/set, save, per-key color
  get/set, mixed-effect region/effect get/set.
- Custom keycodes (`0x7E00..0x7E1F`) decoded to neutral labels (BT slots,
  P2.4G, OS modifier swaps, battery, screenshot, etc.).
- State-notify pump routes unsolicited frames to wireless facade.

Out of scope:

- BT GATT transport.
- Wireless DFU (`0xAA`) — stub only; no UI, intentionally unimplemented to
  avoid bricking firmware mid-flash.
- Analog matrix (`0xA9`) — 8K boards only.
- Factory test (`0xAB`).

## Linux: udev rule (required)

`node-hid` and WebHID need read/write on `hidraw*` for VID `0x3434`. Without
this you'll see `EACCES` when Studio tries to open the device.

Drop the snippet below in `/etc/udev/rules.d/50-keychron.rules`, then
reload:

```
# /etc/udev/rules.d/50-keychron.rules
SUBSYSTEM=="hidraw", ATTRS{idVendor}=="3434", MODE="0660", TAG+="uaccess"
KERNEL=="hidraw*", ATTRS{idVendor}=="3434", MODE="0660", TAG+="uaccess"

# Some Keychron boards bridged via Holtek/Sino-Wealth ship under different
# VIDs while in bootloader mode — add as needed:
# SUBSYSTEM=="hidraw", ATTRS{idVendor}=="0483", MODE="0660", TAG+="uaccess"
```

```
sudo udevadm control --reload-rules
sudo udevadm trigger
```

Replug the keyboard. `ls -l /dev/hidraw*` should now show your user owns
the device (via `uaccess` tag) without root.

## macOS / Windows

No driver setup required. Plug in over USB, Studio enumerates via
WebHID / `node-hid`.

## Per-board overrides

The adapter accepts `{ rows, cols }` so per-board presets can be
registered alongside the default K5 Max profile. See
[`src/firmware/keychron/boards.ts`](../../src/firmware/keychron/boards.ts)
for the table and how to add a new board.

## Wireless model

Keychron's own Launcher only talks USB; the wireless module forwards
HID reports to the keyboard but is not exposed as an independent
GATT/HID-over-BLE service. Studio follows the same model — keep
transport = USB Raw HID and surface BT/2.4G/battery state as commands
over USB. `KEEP_USB_CONNECTION_IN_WIRELESS_MODE` keeps USB alive while
the host-mode dip-switch is in BT/2.4G, so this works even when the
keyboard is paired to another host.
