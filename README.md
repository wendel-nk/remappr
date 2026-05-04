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

## License

See [LICENSE](LICENSE) and [NOTICE](NOTICE).
