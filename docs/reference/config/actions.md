# Actions

An **action** is what a key does. Every entry in a layer's `bindings`, every
combo/tap-dance/mod-morph target, and every encoder direction is an action.

Actions come in two spellings — a friendly **surface shorthand** you write, and
the explicit **object form**. Both are valid input; the app expands shorthand
into the object form internally.

## Surface shorthand {#surface-shorthand}

| You write                                                   | Means                                                                        |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `"Q"`                                                       | A plain keypress. Keycode by friendly name, firmware alias, or canonical id. |
| `"Ctrl+Shift+C"`                                            | A modified keypress (a "combo string").                                      |
| `{ "type": "mod_tap", "tap": "A", "mod": "LEFT_GUI" }`      | Mod-Tap preset → tap = key, hold = modifier.                                 |
| `{ "type": "layer_tap", "tap": "SPACE", "layer": "raise" }` | Layer-Tap preset → tap = key, hold = layer.                                  |

`mod_tap` and `layer_tap` are presets that lower to `tap_hold`. All keycodes are
validated against the catalog (unknown names are rejected with a message) — see
[Keycodes & modifiers](/reference/config/keycodes) for how `"Q"`, `"Vol Up"`,
`"KC_BSPC"` and `"Ctrl+C"` resolve.

## Object form — the full catalog

Every action object has a `type`. Unless noted, fields not listed are absent.

### Keys & tap-hold

| `type`         | Fields                  | Description                                         |
| -------------- | ----------------------- | --------------------------------------------------- |
| `key_press`    | `key`, `mods?`          | A plain (optionally modified) keypress.             |
| `tap_hold`     | `tap`, `hold`, timings  | General tap/hold: tap does one thing, hold another. |
| `mod_tap`      | `tap`, `mod`, timings   | Preset: tap = key, hold = a modifier.               |
| `layer_tap`    | `tap`, `layer`, timings | Preset: tap = key, hold = a layer.                  |
| `key_toggle`   | `key`                   | Press once to latch down, again to release.         |
| `key_repeat`   | —                       | Repeat the previously pressed key.                  |
| `grave_escape` | —                       | Esc normally; Shift/GUI + this sends grave/tilde.   |

**`tap` target** is a bare key string or a `key_press` object.
**`hold` target** is `{ "type": "modifier", "modifier": … }` or
`{ "type": "layer", "layer": "<name>" }`.
**Timings** (all optional): `tappingTermMs`, `quickTapMs`, `resolve`
(`timeout` \| `prefer-hold` \| `prefer-tap`), `flavor`
(`hold-preferred` \| `balanced` \| `tap-preferred` \| `tap-unless-interrupted`).
Setting a timing/flavor gives ZMK a dedicated generated hold-tap node instead of
the global `&mt`/`&lt`.

### Layers

| `type`        | Fields          | Description                                                        |
| ------------- | --------------- | ------------------------------------------------------------------ |
| `layer`       | `mode`, `layer` | Layer switch. `mode`: `momentary` \| `toggle` \| `to` \| `sticky`. |
| `sticky_key`  | `key`           | One-shot key: applies to the next keypress only.                   |
| `caps_word`   | —               | Caps for one word.                                                 |
| `transparent` | —               | Fall through to the layer below.                                   |
| `none`        | —               | Explicitly inert — blocks fall-through.                            |

### Output routing

| `type`   | Fields               | Description                                                         |
| -------- | -------------------- | ------------------------------------------------------------------- |
| `output` | `action`, `profile?` | Output routing. `profile` is valid only with `action: "bluetooth"`. |

`action`: `usb` \| `bluetooth` \| `bluetooth_clear` \| `bluetooth_next` \|
`bluetooth_prev` \| `bluetooth_disconnect` \| `toggle` \| `none`. Wireless
actions need a BLE-capable firmware (see
[capabilities](/reference/config/firmware-targets)).

```json
{ "type": "output", "action": "bluetooth", "profile": 0 }
```

### Lighting {#lighting}

| `type`     | Fields                           | Description                                       |
| ---------- | -------------------------------- | ------------------------------------------------- |
| `lighting` | `target`, `action`, value fields | Control underglow / backlight / per-key lighting. |

- `target`: `underglow` \| `backlight` \| `per_key` (firmware-gated — `per_key`
  is QMK/Keychron only).
- `action`: `toggle` \| `on` \| `off` \| `brightness_up` \| `brightness_down` \|
  `hue_up` \| `hue_down` \| `saturation_up` \| `saturation_down` \|
  `effect_next` \| `effect_previous` \| `speed_up` \| `speed_down` \| `cycle` \|
  `color` \| `set`.
- Value-carrying actions: `color` sets an absolute HSB
  (`hue` 0–360, `saturation`/`brightness` 0–100); `set` sets an absolute
  brightness `level` 0–100.

```json
{ "type": "lighting", "target": "underglow", "action": "brightness_up" }
```

### Device, power & reset

| `type`          | Fields   | Description                                                     |
| --------------- | -------- | --------------------------------------------------------------- |
| `bootloader`    | —        | Reboot into bootloader.                                         |
| `reset`         | —        | Reset the keyboard.                                             |
| `soft_off`      | —        | Power off until a hardware reset / dedicated on-key.            |
| `studio_unlock` | —        | Unlock the keyboard for ZMK Studio live editing.                |
| `ext_power`     | `action` | External/peripheral power. `action`: `toggle` \| `on` \| `off`. |

### Mouse / pointer

| `type`         | Fields      | Description                                                              |
| -------------- | ----------- | ------------------------------------------------------------------------ |
| `mouse_key`    | `button`    | Click a pointer button: `left` \| `right` \| `middle` \| `mb4` \| `mb5`. |
| `mouse_move`   | `direction` | Move the pointer: `up` \| `down` \| `left` \| `right`.                   |
| `mouse_scroll` | `direction` | Scroll the wheel.                                                        |

### References (defined at the top level)

These point at definitions elsewhere in the config — see
[Keymap format](/reference/config/keymap-format).

| `type`      | Fields                         | Points at                                                     |
| ----------- | ------------------------------ | ------------------------------------------------------------- |
| `macro`     | `ref`, `param?`                | A `macros[]` entry. `param` feeds a one-param macro.          |
| `tap_dance` | `ref`                          | A `tapDances[]` entry.                                        |
| `mod_morph` | `ref`                          | A `modMorphs[]` entry.                                        |
| `hold_tap`  | `ref`, `holdParam`, `tapParam` | A `holdTaps[]` entry; the params feed its two inner bindings. |

```json
{ "type": "macro", "ref": "lock_screen" }
```

## Action categories

The picker and JSON palette group actions into categories:

| Category     | Action types                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| **key**      | `key_press`, `sticky_key`, `caps_word`, `transparent`, `none`, `key_toggle`, `key_repeat`, `grave_escape` |
| **tap-hold** | `tap_hold`, `mod_tap`, `layer_tap`                                                                        |
| **layer**    | `layer`                                                                                                   |
| **output**   | `output`                                                                                                  |
| **lighting** | `lighting`                                                                                                |
| **mouse**    | `mouse_key`, `mouse_move`, `mouse_scroll`                                                                 |
| **system**   | `bootloader`, `reset`, `soft_off`, `studio_unlock`, `ext_power`                                           |
| **macro**    | `macro`, `tap_dance`                                                                                      |

## What each action compiles to

The compiler lowers a canonical action straight to the firmware's native token.
A few representative mappings (drawn from the demo compile):

| Action                         | ZMK `.keymap`                                          | QMK `keymap.c`          |
| ------------------------------ | ------------------------------------------------------ | ----------------------- |
| `"Q"`                          | `&kp Q`                                                | `KC_Q`                  |
| `"Ctrl+C"`                     | `&kp LC(C)`                                            | `LCTL(KC_C)`            |
| `mod_tap` (plain)              | `&mt LSHFT A`                                          | `LSFT_T(KC_A)`          |
| `tap_hold` w/ flavor/timing    | a generated `&ht_…` node (`flavor = "hold-preferred"`) | `LT(…)` / mod-tap macro |
| `layer_tap`                    | `&lt 1 SPACE`                                          | `LT(1, KC_SPC)`         |
| `layer` momentary              | `&mo 2`                                                | `MO(2)`                 |
| `output` BT profile            | `&bt BT_SEL 0`                                         | _(warn — wired QMK)_    |
| `lighting` underglow toggle    | `&rgb_ug RGB_TOG`                                      | `RGB_TOG`               |
| `lighting` per_key effect-next | _(warn — no per-key on ZMK)_                           | `RGB_MOD`               |
| `combo`                        | a `combo_<name>` node                                  | combo table entry       |
| `macro`                        | a `zmk,behavior-macro` node                            | a macro                 |
| `tap_dance`                    | a `zmk,behavior-tap-dance` node                        | a tap-dance entry       |
| encoder cw/ccw                 | `&inc_dec_kp …`                                        | encoder map             |

Plain `mod_tap`/`layer_tap` use ZMK's global `&mt`/`&lt`; adding a timing or
`flavor` makes the compiler emit a **dedicated generated hold-tap node** instead.
See [Firmware targets](/reference/config/firmware-targets) for full per-target
output.

## Capability gating

Not every firmware supports every action. When a binding targets a firmware that
lacks it (e.g. a `per_key` lighting action on ZMK, or a Bluetooth output on
wired QMK), the compiler emits a **warning** and drops the binding to a no-op
rather than failing. The per-firmware support table is on the
[Firmware targets](/reference/config/firmware-targets) page.
