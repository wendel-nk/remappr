# BLE Fix Session Summary

**Date:** 2026-05-04
**Branch:** `feat/firmware-adapter-architecture`
**Symptom:** ZMK keyboard does not appear in device list and does not connect on Windows. ZMK uses BLE.

---

## Root Cause

Uncommitted edit to `src/renderer/src/electron/ble.ts:113` flipped `navigator.bluetooth.requestDevice` from
`acceptAllDevices: true` + `optionalServices` to `filters: [{ services: [serviceUuid] }]`.

Web Bluetooth's `filters: [{ services }]` matches the BLE **advertisement** payload, not GATT services exposed after
connect. ZMK firmware does not advertise its Studio service UUID (`00000000-0196-6107-c967-c5cfb1c2482a`) — adv carries
HID (`0x1812`) + device name only.

Result on Windows/macOS:

1. Chromium rejects every advertisement → `select-bluetooth-device` never fires
2. Main process (`src/main/ble-manager.ts:36`) never sends `BLE_DEVICES_DISCOVERED`
3. Renderer's 5 s scan window resolves with `[]`
4. List empty → user has nothing to click → "doesn't connect"

The misleading commit comment claimed parity with Tauri's `bluest::discover_devices(&[SVC_UUID])`. Bluest on Windows
uses WinRT and enumerates paired devices regardless of advertised UUIDs; Chromium has no equivalent.

A second compounding issue: `src/main/ble-manager.ts:60-63` filtered out devices with empty `deviceName`. On Windows,
paired-and-OS-connected ZMK keyboards often surface once with empty name and never re-fire — invisible to picker.

---

## Fixes Applied

### Must-fix (restores listing/connect)

1. **`src/renderer/src/electron/ble.ts:113`** — reverted `requestDevice` to:
   ```ts
   { acceptAllDevices: true, optionalServices: [serviceUuid] }
   ```

2. **`src/main/ble-manager.ts:59-69`** — dropped the `name.length > 0` filter. Empty-name and `Unknown or Unsupported …`
   devices now labeled `BLE <id>`.

### Hardening

3. **`src/main/index.ts:97`** — `webContents.once('did-finish-load')` → `.on(...)`. HMR refreshes and in-renderer
   reloads now re-fire the synthetic-gesture auto-scan. Renderer's `userActivation` guard de-dupes.

4. **`src/renderer/src/electron/ble.ts:312`** — added `await characteristic.stopNotifications()` to abort cleanup.
   Prevents Windows GATT handle leak between connects (manifests as `NetworkError` on retry).

5. **`src/main/index.ts:77`** — registered `setBluetoothPairingHandler` (auto-confirms Just Works pairing; denies
   confirmPin/providePin paths so failures are explicit instead of a 30 s hang).

### Cleanup

6. **`src/main/ipc-handlers.ts:120-131`** + **`src/shared/ipc-types.ts`** — deleted dead `BLE_LIST_DEVICES` /
   `BLE_CONNECT` IPC handlers, channel constants, and invoke-map entries. Web Bluetooth flow uses `BLE_START_SCAN` /
   `BLE_STOP_SCAN` / `BLE_SELECT_DEVICE` / `BLE_DEVICES_DISCOVERED` exclusively.

7. **`package.json`** — removed unused `@abandonware/noble@^1.9.2-26` dependency. `pnpm-lock.yaml` shrunk by 611 lines.
   No source file imported it; BlueZ goes through `dbus-next` instead.

---

## Audit Items Deliberately Skipped

- `setDevicePermissionHandler` does not include `'bluetooth'` deviceType — correct; Web Bluetooth uses session
  permission handlers (`setPermissionCheckHandler` / `setPermissionRequestHandler`), not the device permission handler.
- Module-global `pendingDeviceCallback` / `pendingDevicePromise` / `lastSelectedDeviceId` — single-window app, races are
  theoretical.
- Refresh-mid-connect race on `pendingDevicePromise` — low frequency; revisit if reported.

---

## Files Modified

```
package.json                             |   1 -
pnpm-lock.yaml                           | 611 ---------
src/main/ble-manager.ts                  |  28 +-
src/main/index.ts                        |  28 +
src/main/ipc-handlers.ts                 |  14 -
src/renderer/src/electron/ble.ts         |  47 +-
src/renderer/src/hooks/use-connection.ts |  14 +    (already-modified, not by this session)
src/shared/ipc-types.ts                  |  13 +-
```

---

## Verification

- ✅ `pnpm typecheck` — clean
- ✅ `pnpm exec eslint <edited files>` — 0 errors (CRLF prettier warnings repo-wide pre-existing)
- ⚠️ `pnpm install` — completes, but `electron-builder install-app-deps` postinstall fails on `usocket` native rebuild (
  `sys/ioctl.h` missing — pre-existing Windows toolchain gap, unrelated to BLE work)

### End-to-end test path

1. Stop running Electron processes (see Known Issues below).
2. `pnpm install` — only needed if not already done; lockfile already refreshed in this session.
3. `pnpm edev`.
4. Ensure ZMK keyboard is paired in Windows Bluetooth settings. If shown as **Connected** there, click → Disconnect (do
   **not** Remove).
5. Within ~5 s, keyboard appears in the in-app list. Other nearby BLE devices may also appear — expected, matches
   pre-regression behaviour.
6. Click keyboard row →
  - Successful connect → main app surface loads ✅
  - OR toast: *"GATT connect failed. On Windows, disconnect the keyboard from Bluetooth settings…"* → follow
    instruction, retry → ✅
7. Edit any `.tsx` to trigger HMR. List re-populates within 5 s without manual click — confirms fix #3.
8. Connect → close window or trigger abort → reconnect. No `NetworkError` from leaked GATT — confirms fix #4.

### Cross-platform sanity

- **Linux**: `getPlatform() === 'linux'` → `ElectronBluezAdapter` (D-Bus). Untouched.
- **macOS**: same Web Bluetooth path as Windows. Fixes #1 + #2 restore listing.

### Logs to watch

- Main: `[ble-manager] select-bluetooth-device fired, devices: <n>` — should be > 0 once advertisements arrive.
- Main: `[ble-manager] forwarding to renderer, kept: <n>` — now equals input length (filter removed).
- Renderer: no `[electron/ble] requestDevice rejected:` warnings during the auto-scan window.

---

## Known Issues / Follow-ups

### Lingering electron.exe processes blocking node_modules removal

During session, multiple `electron.exe` processes (PIDs 14656, 29728, 31580, 35236, 18836) prevented `pnpm install` from
cleanly refreshing the lockfile. PID 14656 specifically refuses `Stop-Process -Force` with `Access is denied`.

**Resolution path:**

1. Run PowerShell as Administrator → `Stop-Process -Id 14656 -Force`
2. Or in admin cmd: `taskkill /F /PID 14656`
3. If owned by SYSTEM → reboot is fastest
4. Then: `Remove-Item -Recurse -Force node_modules` → `pnpm install`

### Pre-existing toolchain gap

`usocket` native module fails `node-gyp` rebuild because `sys/ioctl.h` is unavailable on Windows. This is a transitive
dep concern, not introduced by this session. Build still produces a working Electron app for runtime; only impacts
native rebuild during `electron-builder install-app-deps`.

### Pre-existing lint state

Repo has 31199 prettier CRLF warnings + 8 errors in untouched files. None introduced by this session —
`pnpm exec eslint <edited files>` reports 0 errors.
