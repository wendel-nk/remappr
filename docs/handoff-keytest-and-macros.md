# Handoff — Key Test + Macros (firmware-agnostic)

Scope for a fresh session. Two deferred launcher-parity features, designed to
work across **all** firmwares (Keychron-QMK, QMK/VIA, Vial, ZMK, mock) and to
**degrade gracefully** when a firmware can't do part of it (e.g. ZMK has no live
macro editing today). Branch: `feat/remappr-config-system`.

Guiding rule (same as the rest of this codebase): **firmware specifics live in
`src/firmware/<fw>/`, the renderer talks only to neutral facades in
`src/firmware/service.ts`.** A feature is "available" iff the connected
`KeyboardService` exposes the optional facade member — never gate on a hardcoded
firmware name.

---

## Feature 1 — Key Test (live key view from the hardware matrix)

### What it is

A screen that flashes each key as you physically press it — for testing
switches, stuck keys, chatter, and keys that emit no keycode. The Keychron
launcher reads the **actual switch matrix** over the wire, so it catches presses
even when the key sends nothing to the OS.

### What already exists (reuse, don't rebuild)

- `src/renderer/src/features/keymap/keyboard/stage/useLivePresses.ts` — returns
  `Set<number>` of pressed key positions and drives the live-view flash +
  heatmap. **But** it sources presses from **OS keyboard events**
  (`useKeypressDetection` → `lib/keypress/keypressDetector`), mapped to key
  positions via the keymap. That means: focus-dependent, misses non-emitting
  keys, and can't see keys on inactive layers. Good enough as a fallback; not a
  true hardware test.
- The board renderer already accepts a pressed-position set
  (`PhysicalLayoutCanvas` / `KeyboardView` consume `useLivePresses`). The
  visual layer is done — only the _source_ of truth needs a hardware option.

### What to build

1. **Neutral facade** in `service.ts`:
    ```ts
    export interface KeyTestApi {
        /** Subscribe to raw matrix state. Fires the full set of currently-pressed
         *  (row,col)→position indices whenever it changes. Returns an unsubscribe. */
        onMatrixState(cb: (pressed: Set<number>) => void): () => void
        /** Optional: one-shot poll if the firmware has no push channel. */
        readMatrix?(): Promise<Set<number>>
    }
    ```
    Add `keyTest?: KeyTestApi` to `KeyboardService`.
2. **Per-firmware adapters** (only where the protocol supports it):
    - **Keychron-QMK**: there is a matrix/keystate report. Confirm the sub-command
      by HID trace (the `MISC_SUB.SNAP_CLICK_GET_INFO 0x07` area and the factory-
      test path are leads — see `keyboards/keychron/common/factory_test.c` in the
      Keychron qmk repo, branch `2025q3`, which is exactly how the launcher's key
      test works). Map (row,col) → layout position via the existing physical-layout
      matrix data (`keys[].matrix`, added in the generalized-config work).
    - **QMK/VIA, Vial**: VIA has no standard live-matrix channel; Vial has a
      "matrix tester" command (`vial_get_keyboard_state` / `unlock`-gated matrix
      poll) — wire it if present, else omit `keyTest`.
    - **ZMK**: no raw-matrix report over the Studio protocol today → omit.
    - **mock**: synthesize presses for storybook/tests.
3. **Wire `useLivePresses`** to prefer `service.keyTest` when present (subscribe
   to `onMatrixState`), else fall back to the current OS-event detection. Keep the
   return type (`Set<number>`) identical so the renderer is unchanged.
4. **UI**: a "Key Test" entry (likely a Header toggle or a sheet section, mirror
   how the RGB sheet / `rgbSheetStore` is structured). Show a legend: "press every
   key — green once seen", optionally a not-yet-pressed counter. Reset button.

### Gotchas

- Matrix poll is hot — **subscribe/poll only while the Key Test view is open**
  (mirror `usePerKeyPaint`'s active-on-mount / off-on-unmount pattern). HID is
  serialized and ~150ms/round-trip; prefer a push report over busy-polling, and
  if polling, throttle.
- Position mapping must use the **same** physical-layout matrix the editor uses,
  or pressed keys light the wrong cap.

---

## Feature 2 — Macros (record/edit, firmware-agnostic, read-only where unsupported)

### What it is

Create/edit macros — a recorded sequence of keystrokes/delays bound to a key.
Must work across firmwares, and be **read-only / hidden** where the firmware
can't change macros live (ZMK today: macros are compile-time, not editable over
the wire).

### What already exists (reuse, don't rebuild)

- `service.ts` **already defines `MacroApi`**:
    ```ts
    export interface MacroApi {
        getCount(): number
        getMacro(idx: number): Promise<MacroAction[]>
        setMacro(idx: number, actions: MacroAction[]): Promise<void>
    }
    ```
    and `KeyboardService.macros?: MacroApi`, plus `capabilities.macros?: {count, bufferSize}`.
- **QMK/Vial macro codec already implemented**: `src/firmware/qmk-vial/macroCodec.ts`
  (+ `macroCodec.test.ts`) and `qmk-vial/macros.ts` — the VIA `dynamic_keymap`
  macro buffer encode/decode (SS_TAP/SS_DOWN/SS_UP/delay tokens). This is the hard
  part and it's done; verify it's wired into the qmk/vial service's `macros`.
- `MacroAction` type — check its current shape in `@firmware/types` before
  designing the editor; reuse it as the editor's model.

### What to build

1. **Confirm/extend the facade for "can't edit"**: make `setMacro` optional, or
   add `MacroApi.readonly: boolean` (preferred — explicit). A firmware that can
   only _read_ macros (or only show them) exposes `macros` with `readonly: true`
   and a no-op/throwing `setMacro`. The UI keys off this to disable editing.
    ```ts
    export interface MacroApi {
        getCount(): number
        readonly?: boolean // true = view-only (e.g. ZMK)
        getMacro(idx: number): Promise<MacroAction[]>
        setMacro?(idx: number, actions: MacroAction[]): Promise<void>
    }
    ```
2. **Per-firmware adapters**:
    - **QMK/VIA + Vial**: wire `macros` to the existing `qmk-vial/macroCodec` over
      the dynamic-keymap macro buffer. Editable (`readonly` false).
    - **Keychron-QMK**: rides stock VIA `dynamic_keymap` macros → same codec as
      QMK/Vial. Confirm buffer size from `capabilities.macros.bufferSize`.
    - **ZMK**: expose `macros` only if we can _read_ the compiled macros from the
      keymap/config (the generalized-config JSON has macro definitions — see
      `project_remappr_config` / `project_zmk_parity`); set `readonly: true`. If we
      can't even read them yet, omit `macros` for ZMK (UI hides the feature).
    - **mock**: in-memory editable macros for storybook/tests.
3. **UI — macro editor** (new feature dir, e.g. `features/macros/`):
    - List macros 0..count-1, show buffer usage vs `bufferSize`.
    - Per-macro action editor: ordered list of actions (tap / press / release /
      delay / text), add/remove/reorder, with a keycode picker (reuse the existing
      keymap keycode picker / `listKeyCatalog`).
    - **Record mode**: capture OS keystrokes into the action list (reuse the
      keypress detection infra from Key Test / `lib/keypress`).
    - When `macros.readonly`, render view-only with a banner: "This firmware
      doesn't support editing macros from Remappr."
    - Save/persist via `setMacro` + the firmware's save (mirror RGB sheet's footer
      Save pattern).
4. **Binding**: macros are bound to keys via a keycode (QMK `MACRO(n)` /
   `DM_*`). Ensure the keycode catalog/codec surfaces macro keycodes so a key can
   be set to "Macro n" in the normal keymap editor. Check `codec`/`listKeyCatalog`
   already includes them for QMK/Vial.

### Gotchas

- **Don't assume editability** — drive every editing affordance off
  `macros.readonly` / presence of `setMacro`, not the firmware name.
- Buffer is shared across all macros (one byte budget) — validate total size
  before write; surface overflow instead of silently truncating.
- `MacroAction` encoding is firmware-specific — keep the renderer on the neutral
  `MacroAction[]` model; only the codec in `src/firmware/<fw>/` knows bytes.

---

## Plan paths / related memory

- Parity plan: `~/.claude/plans/while-checking-the-keychron-woolly-comet.md`
  (F0–F3 done; Key Test + macros were the explicitly-deferred items).
- RGB sheet plan: `~/.claude/plans/lazy-soaring-tarjan.md`.
- Generalized config (has macro defs + `keys[].matrix` needed for Key Test
  position mapping): `~/.claude/plans/remappr-generalized-buildable-config.md`.
- Memory: `project_keychron_launcher_parity` (parity status + confirmed protocol
  details), `project_remappr_config`, `project_zmk_parity` (ZMK macro support).

## Definition of done

- Key Test: pressing physical keys flashes the right caps via the hardware matrix
  where supported (Keychron-QMK confirmed on a real K5), OS-event fallback
  elsewhere; feature hidden when neither is available. typecheck + tests + lint
  green.
- Macros: editable on QMK/VIA/Vial/Keychron via the existing codec; read-only or
  hidden on ZMK; macro keycodes bindable in the keymap editor. typecheck + tests
  (codec already covered) + lint green.
- Verify on hardware via chrome MCP (user starts dev server, K5 connected) —
  HMR on a firmware-layer edit drops the WebHID connection, so reconnect between
  edits.
