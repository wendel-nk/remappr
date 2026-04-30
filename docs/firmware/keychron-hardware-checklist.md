# Keychron hardware E2E checklist

Run these once with each Keychron board plugged in via USB. Tick items
as they pass; copy the table into the PR/release notes.

## Adapter & probe

- [ ] Studio device list shows `displayName: Keychron (QMK)` (not "QMK
      (VIA)" — that means generic VIA won the probe race).
- [ ] With the Keychron adapter unregistered (comment out
      `import '@firmware/keychron'` in `src/main/index.ts`), the same
      board still connects via `qmk-via` and the keymap is readable.
- [ ] Replug while Studio is running — auto-reconnect works, no stale
      transport handle.

## Keymap

- [ ] All 4 layers populated, expected dimensions (e.g. 6×21 for K5
      Max).
- [ ] Custom keycodes (`0x7E0X`) render with Keychron labels (BT_HST1,
      P2P4G, etc.) instead of raw hex.
- [ ] Edit one key on each layer, hit Save, replug — change persists.
- [ ] Discard rolls back uncommitted edits without affecting saved state.

## Wireless (LK boards: K5 Max, Q-series Max, V-series Max)

- [ ] Wireless modal opens; LPM get round-trips (toggle on/off, reload,
      value matches).
- [ ] LPM timeout edit persists across power cycle.
- [ ] NKRO toggle round-trips. Verify with key-rollover test
      (e.g. n-key tester) on USB.
- [ ] Factory reset — confirm dialog gates invocation. After confirm,
      LPM/NKRO/keymap return to firmware defaults.
- [ ] Flip dip-switch to BT slot 1 → host loses USB suspend gracefully,
      Studio's wireless panel reports `transport: bt, btSlot: 1` (via
      state-notify; allow ~2 s).
- [ ] Battery level visible in wireless panel when running on BT/2.4G.
- [ ] Switch back to USB-cable mode — `transport: usb` reflected.

## RGB (boards with `KEYCHRON_RGB`)

- [ ] LED count matches board spec.
- [ ] Indicators raw bytes round-trip (read, edit one byte, write,
      reload, byte matches).
- [ ] Per-key tab: all LEDs render coloured swatches; click LED 0,
      drag H slider, Write LED — physical LED 0 changes hue.
- [ ] Fill all → all LEDs adopt the chosen colour after Write all.
- [ ] Save persists per-key colours across power cycle.
- [ ] Mixed tab: Regions + Effect read non-empty bytes, edit + write
      round-trips.

## State-notify (`FEATURE_STATE_NOTIFY` boards)

- [ ] No regression on request/response: heavy keymap reads while
      pushing dip-switch toggles do not produce parser errors in the
      console (i.e. unsolicited frames are routed away from response
      queue).

## Diagnostics

- [ ] Linux: `lsusb -d 3434:` shows the keyboard. `ls -l /dev/hidraw*`
      shows user ownership after udev rule applied.
- [ ] `pnpm test --filter keychron` passes.
- [ ] `pnpm typecheck` clean.

## Known limitations to mention to user

- Wireless DFU is not supported by Studio — use Keychron Launcher for
  LKBT51 firmware updates.
- Mixed-effect zone editor surfaces raw bytes; per-board friendly
  schema not yet decoded.
- Per-key RGB type ID mapping (effect numbers) is firmware-defined and
  not labelled in the UI.
