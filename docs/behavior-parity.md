# Behavior parity matrix — ZMK / QMK / Vial / Keychron

This file tracks every keymap behavior across the four firmware
adapters, where it surfaces in the UI, and which gaps remain. Update
when adding/removing actions.

Sources:

- [zmk.dev/docs/keymaps/behaviors](https://zmk.dev/docs/keymaps/behaviors)
- [docs.qmk.fm/keycodes](https://docs.qmk.fm/keycodes)
- [docs.qmk.fm/feature_macros](https://docs.qmk.fm/feature_macros)
- [docs.qmk.fm/features/dynamic_macros](https://docs.qmk.fm/features/dynamic_macros)
- [docs.qmk.fm/features/combo](https://docs.qmk.fm/features/combo)

## How to read this

- **Picker surface** column says where the user picks the binding:
    - _Catalog tile_ — selectable from a tab in the keycode picker.
    - _Action type_ — selectable from the action-type dropdown above the
      picker; usually has slots (mod-tap → mod + key).
    - _Behavior list (ZMK)_ — runtime-fetched from
      `service.listActionTypes()`; ZMK exposes user-defined `&macro_*` /
      `&combo_*` here too.
- **`—`** = the firmware doesn't support this behavior.
- **`✓`** = supported, no special note.
- **`(deferred)`** = the firmware supports it but we haven't surfaced
  it in the UI yet — gap to close.

## Core key + mod behaviors

| Behavior                                             | ZMK | QMK | Vial | Keychron | Picker surface               |
| ---------------------------------------------------- | --- | --- | ---- | -------- | ---------------------------- |
| Key press (`&kp` / `KC_*`)                           | ✓   | ✓   | ✓    | ✓        | catalog tile (Keyboard tab)  |
| Mod-Tap (`&mt` / `MT()`)                             | ✓   | ✓   | ✓    | ✓        | action type                  |
| Sticky key (`&sk` / `OSM()`)                         | ✓   | ✓   | ✓    | ✓        | action type                  |
| Sticky mod-tap (`&kt`)                               | ✓   | —   | —    | —        | behavior list (ZMK)          |
| Mods-only (e.g. `KC_LCTL`)                           | ✓   | ✓   | ✓    | ✓        | catalog tile (Keyboard tab)  |
| Modifier function (`LC(LS(A))` / `LCTL(LSFT(KC_A))`) | ✓   | ✓   | ✓    | ✓        | action-type chain (composed) |

## Layer behaviors

| Behavior                           | ZMK | QMK | Vial | Keychron | Picker surface                             |
| ---------------------------------- | --- | --- | ---- | -------- | ------------------------------------------ |
| Layer-Tap (`&lt` / `LT()`)         | ✓   | ✓   | ✓    | ✓        | action type                                |
| Momentary layer (`&mo` / `MO()`)   | ✓   | ✓   | ✓    | ✓        | action type                                |
| Toggle layer (`&tog` / `TG()`)     | ✓   | ✓   | ✓    | ✓        | action type                                |
| To layer (`&to` / `TO()`)          | ✓   | ✓   | ✓    | ✓        | action type                                |
| Default layer (`DF()`)             | —   | ✓   | ✓    | ✓        | action type (qmk:default-layer)            |
| Persistent default layer (`PDF()`) | —   | ✓   | ✓    | ✓        | action type (qmk:persistent-default-layer) |
| Layer + Mod (`LM()`)               | —   | ✓   | ✓    | ✓        | action type (qmk:layer-mod)                |
| One-shot layer (`&sl` / `OSL()`)   | ✓   | ✓   | ✓    | ✓        | action type                                |
| Tap-toggle layer (`TT()`)          | —   | ✓   | ✓    | ✓        | action type (qmk:tap-toggle-layer)         |
| Layer-tap-on/off (`LTON`/`LTOFF`)  | —   | ✓   | ✓    | ✓        | **(deferred — niche)**                     |

## Dynamic / runtime entries

| Behavior                                      | ZMK     | QMK | Vial | Keychron | Picker surface                                                                               |
| --------------------------------------------- | ------- | --- | ---- | -------- | -------------------------------------------------------------------------------------------- |
| Compile-time macro (`MC_0..MC_15`)            | —       | ✓   | ✓    | ✓        | catalog tile (Macros tab)                                                                    |
| Dynamic-record macro (`DM_REC*` / `DM_PLY*`)  | —       | ✓   | ✓    | ✓        | catalog tile (Macros tab)                                                                    |
| Vial dynamic macro (per-slot contents)        | —       | —   | ✓    | —        | catalog tile (Macros tab, label enriched via `dynamicCatalogStore`)                          |
| ZMK user macro (`&macro_*`)                   | ✓       | —   | —    | —        | catalog tile (Macros tab — `dynamicCatalogStore.extraMacroEntries`, behaviorRef bypass)      |
| Tap-dance (`TD()`)                            | —       | —   | ✓    | —        | action type (vial:tap-dance) + Header → Dynamic Entries → Tap Dance tab                      |
| Combo (control toggle: `combo.on/off/toggle`) | ✓       | ✓   | ✓    | ✓        | catalog tile (Combos tab)                                                                    |
| Combo (per-entry list)                        | ✓       | —   | ✓    | —        | ZMK: catalog tile (Combos tab, behaviorRef bypass) — Vial: Dynamic Entries modal (Combo tab) |
| Key-override (`KO_TOGG/ON/OFF`)               | —       | ✓   | ✓    | ✓        | catalog tile (Misc tab)                                                                      |
| Key-override (per-entry list)                 | —       | —   | ✓    | —        | Header → Dynamic Entries → Key Override tab                                                  |
| Alt-repeat-key (`QK_REP` / `QK_AREP`)         | partial | ✓   | ✓    | ✓        | catalog tile (Misc) + Vial editor                                                            |

## Mode flags / single-keycode features

| Behavior                                | ZMK | QMK | Vial | Keychron | Picker surface                                                                                                              |
| --------------------------------------- | --- | --- | ---- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| Caps Word (`&caps_word` / `CW_TOGG`)    | ✓   | ✓   | ✓    | ✓        | catalog tile (Misc tab)                                                                                                     |
| Leader (`QK_LEAD`)                      | —   | ✓   | ✓    | ✓        | catalog tile (Misc tab — `leader.start`)                                                                                    |
| Auto Shift (`AS_TOGG`/`AS_ON`/`AS_OFF`) | —   | ✓   | ✓    | ✓        | catalog tile (Misc tab)                                                                                                     |
| Swap Hands (`SH_*` family)              | —   | ✓   | ✓    | ✓        | **(deferred — `qmk:swap-hands-tap` action type only; momentary/toggle/on/off/oneshot variants not yet exposed; see Gap 2)** |
| Repeat last (`QK_REP`)                  | ✓   | ✓   | ✓    | ✓        | catalog tile (Misc tab)                                                                                                     |
| Tri-layer (`tri_layer.lower/upper`)     | —   | ✓   | ✓    | ✓        | catalog tile (Misc tab)                                                                                                     |
| Space cadet (`LCPO`/`RSPC`/...)         | —   | ✓   | ✓    | ✓        | catalog tile (Misc tab)                                                                                                     |
| Grave-escape (`GEsc`)                   | —   | ✓   | ✓    | ✓        | catalog tile (Misc tab)                                                                                                     |
| Tap term (`TT_UP`/`TT_DN`/`TT_PRT`)     | —   | ✓   | ✓    | ✓        | catalog tile (Misc tab)                                                                                                     |
| Velocikey (`Velki`)                     | —   | ✓   | ✓    | ✓        | catalog tile (Misc tab)                                                                                                     |

## Hardware / system

| Behavior                                           | ZMK                               | QMK                           | Vial         | Keychron     | Picker surface                                             |
| -------------------------------------------------- | --------------------------------- | ----------------------------- | ------------ | ------------ | ---------------------------------------------------------- |
| Bluetooth profile (`&bt BT_SEL N` / `BT_PRFn`)     | ✓                                 | —                             | —            | ✓            | catalog tile (Wireless tab)                                |
| Output mode (`&out OUT_*`)                         | ✓                                 | —                             | —            | ✓            | catalog tile (Wireless tab)                                |
| RGB underglow                                      | `&rgb_ug ARG` (behavior with arg) | discrete keycodes (`RGB_*`)   | inherits QMK | inherits QMK | **ZMK** action type / **QMK+** catalog tile (Lighting tab) |
| Backlight                                          | `&bl ARG` (behavior with arg)     | discrete keycodes (`BL_*`)    | inherits QMK | inherits QMK | **ZMK** action type / **QMK+** catalog tile (Lighting tab) |
| LED matrix                                         | —                                 | discrete keycodes (`LM_*`)    | ✓            | ✓            | catalog tile (Lighting tab)                                |
| External power (`&ext_power`)                      | ✓                                 | —                             | —            | —            | behavior list (ZMK)                                        |
| Mouse press / move / scroll (`&mkp`/`&mmv`/`&msc`) | ✓                                 | discrete keycodes (`KC_MS_*`) | ✓            | ✓            | **ZMK** action type / **QMK+** catalog tile (Mouse tab)    |
| Sys reset (`&sys_reset` / `QK_BOOT`)               | ✓                                 | ✓                             | ✓            | ✓            | catalog tile (Quantum tab)                                 |
| Bootloader (`&bootloader` / `QK_BOOT`)             | ✓                                 | ✓ (== sys_reset)              | ✓            | ✓            | catalog tile (Quantum tab)                                 |
| Soft off (`&soft_off`)                             | ✓                                 | —                             | —            | —            | behavior list (ZMK)                                        |
| Studio unlock (`&studio_unlock`)                   | ✓                                 | —                             | —            | —            | behavior list (ZMK)                                        |

## MIDI / Audio

| Behavior                                            | ZMK | QMK | Vial | Keychron | Picker surface           |
| --------------------------------------------------- | --- | --- | ---- | -------- | ------------------------ |
| Audio (`AU_ON/OFF/TOG`)                             | —   | ✓   | ✓    | ✓        | catalog tile (Audio tab) |
| Music mode (`MU_ON/OFF/TOG`)                        | —   | ✓   | ✓    | ✓        | catalog tile (Audio tab) |
| Clicky (`CK_ON/OFF/UP/DN/RST`)                      | —   | ✓   | ✓    | ✓        | catalog tile (Audio tab) |
| MIDI note / channel / velocity / octave / transpose | —   | ✓   | ✓    | ✓        | catalog tile (MIDI tab)  |

## Joystick / Programmable buttons

| Behavior                                            | ZMK | QMK | Vial | Keychron | Picker surface          |
| --------------------------------------------------- | --- | --- | ---- | -------- | ----------------------- |
| Joystick button 0..31                               | —   | ✓   | ✓    | ✓        | catalog tile (Misc tab) |
| Programmable button 1..32 (`PROGRAMMABLE_BUTTON_*`) | —   | ✓   | ✓    | ✓        | catalog tile (Misc tab) |

## Magic / config-time keycodes

| Behavior                                                    | ZMK | QMK | Vial | Keychron | Picker surface           |
| ----------------------------------------------------------- | --- | --- | ---- | -------- | ------------------------ |
| `MAGIC_*` family (CL_SWAP, CG_SWAP, NK_TOGG, GUI_TOG, etc.) | —   | ✓   | ✓    | ✓        | catalog tile (Magic tab) |

## Vial / per-board

| Behavior                                  | ZMK | QMK | Vial | Keychron | Picker surface                                                  |
| ----------------------------------------- | --- | --- | ---- | -------- | --------------------------------------------------------------- |
| Vial reset (jump to bootloader)           | —   | —   | ✓    | —        | action type (vial:reset)                                        |
| Vial user keycodes (per-board custom)     | —   | —   | ✓    | —        | action type (vial:user) — populated from board's customKeycodes |
| Keychron user keycodes (`QK_KB` 0x7E00..) | —   | —   | —    | ✓        | catalog tile (OS Keys tab)                                      |

---

## Open gaps

### Gap 1 — ZMK `&macro_*` / `&combo_*` as catalog tiles — **CLOSED**

Implementation: `dynamicCatalogStore.fetchBehaviorEntries` walks
`service.listActionTypes()`, classifies each ActionType via
`classifyBehavior` (uses `displayNameToBinding` + lowercase fallback),
and produces `CatalogEntry` rows with `behaviorRef: { kind }` for the
macro/combo tabs. `use-keycode-filter.mergeBehaviorEntries` appends
them to the Macros / Combos pages (synthesizing the page when codec
filtering dropped it). `KeycodePickerGrid` adds `onClickOverride` on
KeycodeButton when an entry has `behaviorRef`, calling
`onActionChosen(kind)` which threads up SlotValuePicker →
ActionSlotsPicker → KeyActionPicker → handleTypeSelected (skips slot
fill, dispatches `{kind, params: []}` directly). ActionTypeSelector
gets `hideIds: Set<string>` so the dropdown hides the same behaviors
(KeyActionPicker computes via `isMacroOrCombo`); existing macro
bindings still resolve their selected label since the lookup uses
the unfiltered list.

### Gap 2 — QMK swap-hands variants

QMK exposes seven swap-hands keycodes:
`SH_T(kc)`, `SH_TOG`, `SH_TT`, `SH_MON`, `SH_MOFF`, `SH_OFF`, `SH_ON`,
`SH_OS`. We currently expose only `qmk:swap-hands-tap` (`SH_T`).

**Plan:** add the six parameterless variants as **catalog tiles**
under a new `swap_hands.*` canonical-id family in `MISC_ENTRIES`,
with hex mappings in `keycodes-hex.ts` (range `0x56F1..0x56F7`).
Capability gate via `capabilities.behaviors.swapHands`.

### Gap 3 — In-line tap-dance editor from BindingEditor

Today `vial:tap-dance` action picks an index, but editing the
indexed entry's keycode slots requires opening
**Header → Dynamic Entries → Tap Dance tab** separately. A nicer flow:
clicking the index in the action picker opens an inline modal that
preloads that index for edit + save.

**Plan:** wire `BindingEditor.tsx` to open the existing TapDanceTab
inside a modal preloaded with the picked index when the user double-
clicks the slot, or via an "Edit…" affordance next to the index input.

### Gap 4 — Capability flags not yet enforced in action picker

`Capabilities.behaviors.{capsWord,leader,autoShift,swapHands}` are
declared (PR2) but no UI gates them yet. When we add swap-hands
variants (Gap 2), filter them out of the catalog by `behaviors.swapHands === false`
on adapters that lack support (e.g. ZMK).

### Gap 5 — Vial macro overlay labels not yet rendered in tooltip

`dynamicCatalogStore.macroOverlays` provides labels like
"Open Slack" derived from the first text fragment of a Vial macro.
The picker tile's `label` is overlaid via
`use-keycode-filter.enrichMacroEntries`, but the tooltip's `name` /
`description` (rendered by `KeycodeButton`) still shows the static
"Vial macro slot 0". Pass overlay description through too.
