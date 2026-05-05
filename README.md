# Remappr

Cross-platform desktop keymap editor for ZMK, QMK, Vial, and Keychron keyboards.
Wraps a single React UI in either an Electron or Tauri shell so the same
firmware adapters serve both targets.

## Stack

- **UI:** React 19, Vite 7, Tailwind 4, shadcn/ui, react-aria-components
- **Shell:** Electron 39 (primary) + Tauri 2 (alternate)
- **State:** Zustand, Immer
- **Firmware adapters:** ZMK (BLE/serial), QMK (raw HID via VIA), Vial, Keychron
- **Testing:** Vitest, Storybook 10

## Prerequisites

- Node.js >= 20 (see `.nvmrc`)
- pnpm 10.30.x — managed via the `packageManager` field; install with
  `corepack enable` if needed
- Linux only: BlueZ + D-Bus running for direct GATT (BLE) access
- macOS only: Xcode command-line tools for `node-hid` / `serialport` builds
- Tauri build target only: Rust toolchain + platform deps from
  https://tauri.app/start/prerequisites/

## Setup

```bash
pnpm install
```

`postinstall` runs `electron-builder install-app-deps` to compile the
native modules (`node-hid`, `serialport`, `dbus-next`) against Electron's
ABI.

## Development

| Command          | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `pnpm edev`      | Electron dev (renderer + main + preload, hot reload)       |
| `pnpm tauri-dev` | Tauri dev shell (`vite --port 5174` + Rust)                |
| `pnpm dev`       | Renderer-only Vite dev server (port 5174, browser preview) |
| `pnpm storybook` | Storybook on port 6006                                     |

## Quality gates

```bash
pnpm typecheck      # tsc --noEmit (node + web projects)
pnpm lint           # eslint with --report-unused-disable-directives
pnpm test           # vitest run
pnpm format         # prettier --write .
```

## Build

```bash
pnpm ebuild         # typecheck + electron-vite build (no installer)
pnpm build:linux    # electron-builder Linux installer
pnpm build:mac      # electron-builder macOS installer
pnpm build:win      # electron-builder Windows installer
pnpm build          # Vite-only renderer build (used by Tauri)
pnpm tauri build    # Tauri release bundle
```

## Layout

```
src/
  main/        Electron main process: BLE, HID, serial, IPC, lifecycle
  preload/     Context-isolated bridge — whitelisted IPC surface
  renderer/    React app (Vite root)
  firmware/    Firmware adapters (zmk, qmk, qmk-vial, keychron, mock)
  shared/      Cross-process types + logger
src-tauri/     Rust shell (Tauri build path)
docs/firmware/ Per-vendor adapter notes
```

## Roadmap

> ✅ Done · 🚧 In Progress · 🗓️ Planned · 🔮 Future (fork goals beyond upstream)

### ZMK

#### Core Studio Features

| Status                                                     | Feature                                                      |
|------------------------------------------------------------|--------------------------------------------------------------|
| <abbr title="Done">✅</abbr>                                | Real-time keymap changes (no reflash)                        |
| <abbr title="Done">✅</abbr>                                | USB / serial (CDC-ACM) transport                             |
| <abbr title="Done">✅</abbr>                                | BLE transport (Linux native via BlueZ)                       |
| <abbr title="Done">✅</abbr>                                | Key / behavior assignment                                    |
| <abbr title="Done">✅</abbr>                                | Alternative physical layout selection                        |
| <abbr title="Done">✅</abbr>                                | Layer renaming                                               |
| <abbr title="Done">✅</abbr>                                | Extra layer enabling                                         |
| <abbr title="Done">✅</abbr>                                | Device lock / unlock                                         |
| <abbr title="In Progress">🚧</abbr>                        | Basic behavior property configuration (hold-tap timing)      |
| <abbr title="Planned">🗓️</abbr>                           | Advanced behavior properties (tap-dance params, macro steps) |
| <abbr title="Planned">🗓️</abbr>                           | Combo configuration                                          |
| <abbr title="Planned">🗓️</abbr>                           | Conditional layer setup                                      |
| <abbr title="Planned">🗓️</abbr>                           | Host locale / HID locale selection                           |
| <abbr title="Planned">🗓️</abbr>                           | Keymap import / export (devicetree round-trip)               |
| <abbr title="Planned">🗓️</abbr>                           | Encoder behavior assignment                                  |
| <abbr title="Future — fork goal beyond upstream">🔮</abbr> | New behavior definition (beyond devicetree)                  |
| <abbr title="Future — fork goal beyond upstream">🔮</abbr> | New physical layout creation                                 |
| <abbr title="Future — fork goal beyond upstream">🔮</abbr> | Layer count expansion beyond devicetree spec                 |

#### ZMK Behaviors — Binding Support

**Key Press**

| Status                      | Behavior     | Tag           |
|-----------------------------|--------------|---------------|
| <abbr title="Done">✅</abbr> | Key Press    | `&kp`         |
| <abbr title="Done">✅</abbr> | Mod-Tap      | `&mt`         |
| <abbr title="Done">✅</abbr> | Key Toggle   | `&kt`         |
| <abbr title="Done">✅</abbr> | Sticky Key   | `&sk`         |
| <abbr title="Done">✅</abbr> | Grave Escape | `&gresc`      |
| <abbr title="Done">✅</abbr> | Caps Word    | `&caps_word`  |
| <abbr title="Done">✅</abbr> | Key Repeat   | `&key_repeat` |
| <abbr title="Done">✅</abbr> | Transparent  | `&trans`      |
| <abbr title="Done">✅</abbr> | None / Block | `&none`       |

**Layer Navigation**

| Status                      | Behavior        | Tag    |
|-----------------------------|-----------------|--------|
| <abbr title="Done">✅</abbr> | Momentary Layer | `&mo`  |
| <abbr title="Done">✅</abbr> | Layer-Tap       | `&lt`  |
| <abbr title="Done">✅</abbr> | To Layer        | `&to`  |
| <abbr title="Done">✅</abbr> | Toggle Layer    | `&tog` |
| <abbr title="Done">✅</abbr> | Sticky Layer    | `&sl`  |

**Bluetooth & Output**

| Status                      | Behavior                    | Tag    |
|-----------------------------|-----------------------------|--------|
| <abbr title="Done">✅</abbr> | Bluetooth control           | `&bt`  |
| <abbr title="Done">✅</abbr> | Output selection (BT / USB) | `&out` |

**Reset & Boot**

| Status                      | Behavior      | Tag              |
|-----------------------------|---------------|------------------|
| <abbr title="Done">✅</abbr> | System Reset  | `&sys_reset`     |
| <abbr title="Done">✅</abbr> | Bootloader    | `&bootloader`    |
| <abbr title="Done">✅</abbr> | Studio Unlock | `&studio_unlock` |

**Lighting**

| Status                           | Behavior      | Tag       |
|----------------------------------|---------------|-----------|
| <abbr title="Planned">🗓️</abbr> | RGB Underglow | `&rgb_ug` |
| <abbr title="Planned">🗓️</abbr> | Backlight     | `&bl`     |

**Power Management**

| Status                           | Behavior       | Tag          |
|----------------------------------|----------------|--------------|
| <abbr title="Planned">🗓️</abbr> | External Power | `&ext_power` |
| <abbr title="Planned">🗓️</abbr> | Soft Off       | `&soft_off`  |

**Mouse Emulation**

| Status                           | Behavior     | Tag    |
|----------------------------------|--------------|--------|
| <abbr title="Planned">🗓️</abbr> | Mouse Button | `&mkp` |
| <abbr title="Planned">🗓️</abbr> | Mouse Move   | `&mmv` |
| <abbr title="Planned">🗓️</abbr> | Mouse Scroll | `&msc` |

**User-Defined Behaviors**

| Status                              | Behavior                         |
|-------------------------------------|----------------------------------|
| <abbr title="In Progress">🚧</abbr> | Hold-Tap (basic property config) |
| <abbr title="Planned">🗓️</abbr>    | Tap Dance                        |
| <abbr title="Planned">🗓️</abbr>    | Macros                           |
| <abbr title="Planned">🗓️</abbr>    | Mod-Morph                        |
| <abbr title="Planned">🗓️</abbr>    | Sensor Rotation                  |

#### Advanced ZMK Features

| Status                           | Feature                                             |
|----------------------------------|-----------------------------------------------------|
| <abbr title="Done">✅</abbr>      | Bluetooth profile management (5 profiles)           |
| <abbr title="Done">✅</abbr>      | BLE Secure Connection (ECDH)                        |
| <abbr title="Planned">🗓️</abbr> | Combos (timeout, key positions, layer restrictions) |
| <abbr title="Planned">🗓️</abbr> | Conditional Layers (if-layers → then-layer)         |
| <abbr title="Planned">🗓️</abbr> | Encoder rotation bindings (CW / CCW per layer)      |

---

### QMK / VIA / Vial / Keychron

#### Core QMK / VIA

| Status                           | Feature                                |
|----------------------------------|----------------------------------------|
| <abbr title="Done">✅</abbr>      | Raw HID transport (VIA protocol)       |
| <abbr title="Done">✅</abbr>      | Layout sideloading via `keyboard.json` |
| <abbr title="Done">✅</abbr>      | Standard key / layer assignment        |
| <abbr title="Done">✅</abbr>      | Modifier keys & combinations           |
| <abbr title="Done">✅</abbr>      | Media & system keys                    |
| <abbr title="Done">✅</abbr>      | Layer switching (MO / TG / LT / DF)    |
| <abbr title="Done">✅</abbr>      | One-shot modifiers                     |
| <abbr title="Planned">🗓️</abbr> | Mouse keys (movement, buttons, wheel)  |
| <abbr title="Planned">🗓️</abbr> | Bootmagic config                       |
| <abbr title="Planned">🗓️</abbr> | EEPROM reset                           |

#### Vial Advanced Features

| Status                           | Feature                                                             |
|----------------------------------|---------------------------------------------------------------------|
| <abbr title="Done">✅</abbr>      | Device lock / unlock                                                |
| <abbr title="Done">✅</abbr>      | Tap Dance (onTap / onHold / onDoubleTap / onTapHold / tapping term) |
| <abbr title="Done">✅</abbr>      | Combos (up to 4 keys + output)                                      |
| <abbr title="Done">✅</abbr>      | Key Overrides (remap rules with activation options)                 |
| <abbr title="Done">✅</abbr>      | Macros (tap / down / up / delay / text sequences)                   |
| <abbr title="Done">✅</abbr>      | Encoder behavior per layer (CW / CCW)                               |
| <abbr title="Done">✅</abbr>      | Alt-Repeat-Key                                                      |
| <abbr title="Planned">🗓️</abbr> | QMK Settings panel (tapping term, debounce, etc.)                   |
| <abbr title="Planned">🗓️</abbr> | RGB underglow effect + color config                                 |
| <abbr title="Planned">🗓️</abbr> | Backlight brightness                                                |
| <abbr title="Planned">🗓️</abbr> | Auto Shift config                                                   |
| <abbr title="Planned">🗓️</abbr> | Caps Word config                                                    |
| <abbr title="Planned">🗓️</abbr> | One-Shot config                                                     |

#### Keychron Extensions

| Status                           | Feature                                        |
|----------------------------------|------------------------------------------------|
| <abbr title="Done">✅</abbr>      | RGB per-key lighting editor                    |
| <abbr title="Done">✅</abbr>      | RGB mixed-region control                       |
| <abbr title="Done">✅</abbr>      | Wireless settings (LPM, USB / BT / 2.4G, NKRO) |
| <abbr title="Done">✅</abbr>      | Encoder support                                |
| <abbr title="Planned">🗓️</abbr> | Dynamic debounce config                        |

---

### App-Level

| Status                           | Feature                                                               |
|----------------------------------|-----------------------------------------------------------------------|
| <abbr title="Done">✅</abbr>      | Electron shell (Windows / macOS / Linux)                              |
| <abbr title="Done">✅</abbr>      | Tauri shell (alternate build target)                                  |
| <abbr title="Done">✅</abbr>      | Firmware adapter abstraction (plug-in per vendor)                     |
| <abbr title="Done">✅</abbr>      | Capability-gated UI (features shown only when firmware supports them) |
| <abbr title="Planned">🗓️</abbr> | Keymap import / export                                                |
| <abbr title="Planned">🗓️</abbr> | Cloud sync / backup                                                   |
| <abbr title="Planned">🗓️</abbr> | Profile sharing                                                       |

---

## License

Licensed under the [Apache License 2.0](LICENSE) — see [NOTICE](NOTICE) for
copyright information.

> Remappr was originally forked from [ZMK Studio](https://github.com/zmkfirmware/zmk-studio).
> The application layer (renderer, main process, firmware adapters) has been
> fully rewritten. The Tauri shell under `src-tauri/` is retained from the
> upstream fork and remains under Apache 2.0 — see [NOTICE](NOTICE).
