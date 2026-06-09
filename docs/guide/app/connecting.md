# Connecting a device

When you open Remappr you land on the **Start Page** — _"Configure Your Keyboard
— connect your keyboard to customize keymaps and settings."_ It is where you
connect hardware, open the builder, or try the demo.

::: info 📷 Screenshot slot — `docs/public/images/app/start-page.png`
The Start Page: the **Available Devices** card, the **Create a keyboard**
builder card, and the **Try Demo Mode** / **Get the desktop app** cards.
:::

## Connect to a keyboard

The **Available Devices** card lists detected devices.

- _"Select a device to connect"_ (or _"Select a connection type"_ for
  simple-connect transports).
- The **Refresh** button (↻) re-scans.
- Supported transports:
    - **ZMK** — USB/serial (CDC-ACM) or BLE; the board needs ZMK Studio enabled.
    - **QMK / VIA / Vial** — raw HID via the VIA protocol.
    - **Keychron** — VIA/QMK + a BLE radio.

Pick a device and Remappr opens the [keymap editor](/guide/editor) on its live
keymap, showing only the features that firmware supports.

## Unlocking

Some boards require unlocking before editing. You'll see an **Unlock To
Continue** overlay — _"For security reasons, your keyboard requires unlocking
before using Remappr."_ On ZMK this means assigning the
[Studio Unlock](https://zmk.dev/docs/keymaps/behaviors/studio-unlock) behavior to
a key or combo and pressing it.

## The device menu

Once connected, the device menu shows the device name and **Connected · USB**
(or **BLE**). Its dropdown has:

- **Disconnect**
- **Restore Stock Settings** — _"removes any customizations previously made in
  Remappr and restores the stock keymap."_
- **App settings**

## Create a keyboard

The **Create a keyboard** card (badge **BUILDER**) opens the
[Builder](/guide/builder/overview): _"Design a board from scratch — layout,
matrix & firmware. Import KLE, start from a preset, then export a build-ready
config."_ During alpha/beta it shows a **{stage} · FREE** badge and **Open
builder**; at GA it becomes premium (**🔒 Premium**).

## Try Demo Mode

**Try Demo Mode** — _"Explore Remappr with a simulated keyboard — no device
required."_ Opens the editor against a simulated 36-key Corne, the same
config-driven flow as a real device. Good for learning before you connect
hardware.

## Get the desktop app

**Get the desktop app** downloads the latest Remappr build for your OS — the
desktop app has native USB/BLE/HID access the browser can't always provide.

## Next

[The keymap editor →](/guide/editor)
