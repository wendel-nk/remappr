# Normalization & round-trip

The config has two forms — the friendly **surface** form you write, and the
explicit **canonical** form (`ConfigKeymap`) the app holds and the compilers
consume. **Normalize** lowers surface → canonical on load; **serialize** collapses
canonical → surface on save. This page is the contract between them.

```
surface JSON ──parseSurface──► (validated) ──normalizeKeymap──► ConfigKeymap
   ▲                                                                │
   └──────────────── serializeKeymap (denormalize) ◄────────────────┘
```

## What normalize expands

Every shorthand becomes one explicit node, so compile/edit code never branches on
surface sugar:

| Surface                                                     | Canonical                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `"Q"`                                                       | `{ "type": "key_press", "key": <id> }`                                                     |
| `"Ctrl+C"`                                                  | `{ "type": "key_press", "key": <C>, "mods": ["LEFT_CTRL"] }`                               |
| `{ "type": "mod_tap", "tap": "A", "mod": "LEFT_GUI" }`      | `{ "type": "tap_hold", "tap": {…}, "hold": { "type":"modifier", "modifier":"LEFT_GUI" } }` |
| `{ "type": "layer_tap", "tap": "SPACE", "layer": "raise" }` | `{ "type": "tap_hold", "tap": {…}, "hold": { "type":"layer", "layer":"raise" } }`          |

The original spelling is stashed on hint fields so serialize can put it back:

- `_keySrc` — the exact key token you typed (a canonical id or alias).
- `_preset` — `"mod_tap"` / `"layer_tap"`, so a lowered `tap_hold` re-emits as the
  preset you wrote.
- `_paramSrc` — a macro param's original key token.

These `_`-prefixed fields are **never read by the compiler** — only by serialize.

## What serialize strips: defaults

To keep saved configs minimal, any field equal to its **default** is dropped on
save and re-filled on load/build, so behavior is preserved while the JSON stays
readable.

| Field           | Default                           | Notes                                            |
| --------------- | --------------------------------- | ------------------------------------------------ |
| key `w`, `h`    | `1`                               | a plain 1U key serializes to just `{ "x", "y" }` |
| key `r`         | `0`                               | rotation omitted when zero                       |
| `tappingTermMs` | `200`                             | universal                                        |
| `quickTapMs`    | `0` (ZMK) / `200` (QMK, Keychron) | **target-dependent**                             |

A tap-hold timing is emitted only when it is set **and** differs from the target
default. `resolve` and `flavor` have no numeric default, so they round-trip
whenever set.

::: warning Target-dependent defaults
QMK's quick-tap term defaults to the tapping term (`200`), ZMK's to `0`. So the
_same_ canonical value can serialize differently depending on `meta.target`. The
[JSON Schema](/reference/config/json-schema) marks defaulted fields optional so a
minimized config validates clean.
:::

## What is never stripped

Anything describing the **physical board** stays visible whenever set — it is not
defaulted away: `keyboard.hardware`, `pins`, `kscan`, `layouts`, `split`,
`firmware[]`, `vendorId`/`productId`, and per-key `variant` / `pin` / `element`,
plus `lighting`. These are keyboard-specific facts, not behavior defaults.

## Round-trip fidelity

`serialize` defaults to the compact, reads-like-English surface form (bare-string
keys, `"Ctrl+C"` combos, presets, friendly names). But:

- A key you wrote as a canonical id or specific alias keeps that exact spelling
  (via `_keySrc`) as long as it still resolves to the same key.
- Top-level and object key order is **fixed**, so re-saves are stable diffs.
- `preferredSourceJson` returns your original source verbatim when the config has
  not diverged from it — so opening and re-saving an untouched file is a no-op.

The result: a hand-authored config survives a load → edit → save cycle without
spurious churn.

## Entry points (developer)

From `@firmware/config`:

- `parseSurface(json)` / `safeParseSurface(json)` — validate surface form.
- `normalizeKeymap(surface)` / `parseKeymap(json)` — surface → canonical.
- `serializeKeymap(config)` / `toSurfaceObject(config)` — canonical → surface.
- `preferredSourceJson(config, originalSource)` — verbatim when unchanged.

## See also

- [Keycodes & modifiers](/reference/config/keycodes) — how key tokens resolve
- [Keymap format](/reference/config/keymap-format) — the field reference
- [JSON Schema](/reference/config/json-schema)
