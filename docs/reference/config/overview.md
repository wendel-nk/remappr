# JSON keymap config

Remappr's central abstraction is one **generalized, firmware-agnostic keymap
config** — a single JSON document that is the _source of truth_. The live editor
reads from it, your edits write back into it, and the exporter compiles it per
firmware. Nothing round-trips through a lossy runtime model.

```
device / builder ──► parse ──► normalize ──► ConfigKeymap ──► editor & export
                    (surface)             (canonical, in memory)
                                                  │
   export / download  ◄── serialize ◄────────────┘
                         (surface JSON)

   compile ──► getCompiler(target).compile(config) ──► firmware files
```

## Surface vs canonical

The config has **two forms of the same data**:

- **Surface form** — the friendly form you write and that gets saved. It is
  permissive about spelling: a key can be a bare string (`"Q"`), a combo string
  (`"Ctrl+C"`), or a preset object (`mod_tap`, `layer_tap`).
- **Canonical form** — the explicit, fully-expanded form (`ConfigKeymap`) the app
  holds in memory and the compilers consume. Every surface shorthand is lowered
  into an explicit action node, so compile and live-edit code never has to branch
  on surface sugar.

`normalize` expands surface → canonical on load; `serialize` collapses canonical
→ surface on save, preserving your original spelling where it can (so a config
you hand-wrote round-trips without churn). You generally **author surface form**;
the [keymap-format](/reference/config/keymap-format) and
[actions](/reference/config/actions) pages document it.

## The top-level document

```jsonc
{
    "schemaVersion": 1,
    "kind": "remappr.keymap",
    "meta": {
        /* name, author, target, USB ids … */
    },
    "defaults": {
        /* global tapping-term / quick-tap / combo-timeout */
    },
    "keyboard": {
        /* geometry, matrix, controller, hardware, lighting … */
    },
    "layers": [
        /* per-layer bindings */
    ],
    "combos": [
        /* optional */
    ],
    "tapDances": [
        /* optional */
    ],
    "macros": [
        /* optional */
    ],
    "modMorphs": [
        /* optional */
    ],
    "holdTaps": [
        /* optional custom hold-tap defs */
    ],
    "conditionalLayers": [
        /* optional */
    ],
}
```

Every field is detailed in [Keymap format](/reference/config/keymap-format).
`schemaVersion` and `kind` are fixed identifiers; older docs are migrated
forward on load.

## Validation

The surface form is validated by a [Zod](https://zod.dev) schema with a
human-readable message on every field, plus a cross-reference pass (layer names,
macro/dance/morph references, matrix bounds). That same schema is converted to a
[JSON Schema](/reference/config/json-schema) that powers live red-squiggle
validation and autocomplete in the builder's JSON editor and in your own IDE.

## Where to go next

- [Keymap format](/reference/config/keymap-format) — every top-level field
- [Actions](/reference/config/actions) — the binding catalog, categories, compiled output
- [Keycodes & modifiers](/reference/config/keycodes) — how key tokens resolve
- [Hardware](/reference/config/hardware) — matrix, kscan, controller, lighting HW, generated `.conf`
- [Firmware targets](/reference/config/firmware-targets) — capability matrix + output examples
- [Normalization & round-trip](/reference/config/normalization) — surface ↔ canonical, defaults
- [JSON Schema](/reference/config/json-schema) — IDE validation/autocomplete
