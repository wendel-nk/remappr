# Keycodes & modifiers

Remappr does **not** invent a keycode namespace. Every keycode you write —
`"A"`, `"Space"`, `"Vol Up"`, `"KC_BSPC"`, or a raw canonical id like
`"key.keyboard_spacebar"` — resolves to one **canonical key id** from the shared
catalog. One vocabulary, not three.

## How a keycode token resolves

When you write a key string, it is matched in this order (first hit wins):

1. **Exact canonical id** — e.g. `"key.keyboard_spacebar"`.
2. **Strict match** — the token upper-cased, against ids, then aliases, then the
   display label, then the long name.
3. **Loose match** — separators (spaces, `_`, `-`) stripped, so `"Vol Up"`,
   `"VOL_UP"` and `"vol-up"` all collapse to the same key.

If nothing resolves, validation rejects it with `unknown keycode "<token>"`. On a
collision, priority is **canonical id > alias > label > name** — a weaker
spelling can never steal a name a stronger one owns.

```json
"A"                       // label
"Vol Up"                  // loose match → consumer volume-up
"KC_BSPC"                 // QMK alias
"key.keyboard_spacebar"   // raw canonical id
```

All four are valid; all resolve to a single canonical key.

## Modifiers

Eight canonical modifiers:

| Canonical     | Friendly (on re-save) | Common aliases you can type                            |
| ------------- | --------------------- | ------------------------------------------------------ |
| `LEFT_CTRL`   | `Ctrl`                | `LCTRL` `LCTL` `LC` `CTRL` `CONTROL` `CTL`             |
| `LEFT_SHIFT`  | `Shift`               | `LSHIFT` `LSFT` `LS` `SHIFT` `SFT`                     |
| `LEFT_ALT`    | `Alt`                 | `LALT` `LA` `ALT` `OPT` `OPTION`                       |
| `LEFT_GUI`    | `Gui`                 | `LGUI` `LG` `GUI` `CMD` `COMMAND` `WIN` `META` `SUPER` |
| `RIGHT_CTRL`  | `RCtrl`               | `RCTRL` `RCTL` `RC`                                    |
| `RIGHT_SHIFT` | `RShift`              | `RSHIFT` `RSFT` `RS`                                   |
| `RIGHT_ALT`   | `RAlt`                | `RALT` `RA` `ALTGR`                                    |
| `RIGHT_GUI`   | `RGui`                | `RGUI` `RG`                                            |

Bare `CTRL` / `SHIFT` / `ALT` / `GUI` default to the **left** side (the common
case for combo strings).

## Combo strings

A `+`-joined token is a **modified keypress**: the last segment is the key, the
leading segments are modifiers.

```json
"Ctrl+C"            // LEFT_CTRL + C
"Ctrl+Shift+4"      // LEFT_CTRL + LEFT_SHIFT + 4
"Cmd+Space"         // LEFT_GUI + Space
"Gui+Alt+L"         // multiple mods
```

Each lowers to a `key_press` with `mods` (see [Actions](/reference/config/actions)
and [Normalization](/reference/config/normalization)).

## Keycode catalog groups

The picker (and the JSON autocomplete palette) groups keycodes into catalog
pages. The available groups include:

`Keyboard` · `Language` · `Consumer` · `AC` · `AL` · `Contact` · `Media` ·
`Wireless` · `OS Keys` · `Lighting` · `Audio` · `Mouse` · `Magic` · `Quantum` ·
`Macros` · `Combos` · `Misc` · `MIDI`, plus Bluetooth/output groups
(`Bluetooth host slot 1–5`, `Next/Previous Bluetooth profile`,
`Output to USB` / `Output to Bluetooth`, `Show battery level`, …) and Mac OS keys
(`Left Command (Mac)`, `Right Option (Mac)`, …).

Each entry carries a name, description and notes — the same text the visual
picker shows, surfaced as hover tooltips in the JSON editor.

## Friendly names on re-save

When Remappr serializes, it prefers a **friendly display token** (the label, or a
short non-prefixed alias ≤16 chars). But if you originally wrote a canonical id or
a specific alias, that exact spelling is preserved (stashed on `_keySrc`) as long
as it still resolves to the same key — so a hand-written config round-trips
without churn. See [Normalization & round-trip](/reference/config/normalization).

## See also

- [Actions](/reference/config/actions) — where keycodes are used
- [Normalization](/reference/config/normalization) — surface ↔ canonical
