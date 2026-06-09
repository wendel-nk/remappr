# Architecture

This section is for contributors hacking on the config layer and compilers. For
the whole-repo map (shells, adapters, stores, where-to-change), start with
[Project structure](/dev/project-structure); this page zooms into the config
subsystem.

The whole subsystem lives under `src/firmware/config/` and is exported through one
barrel, `@firmware/config` (`src/firmware/config/index.ts`). It depends only on
the keycode catalog and shared types — no UI, no transport.

## The data-flow

```
┌── device (MockKeyboardService.getConfigSource) ──┐
│                                                  │   source JSON (surface form)
└── builder canvas / Edit JSON ────────────────────┘
                     │
                     ▼
            parseSurface()         Zod validation + cross-reference checks
                     │             (schema.ts)
                     ▼
            normalizeKeymap()      expand shorthand → explicit nodes
                     │             (normalize.ts)
                     ▼
            ConfigKeymap           the canonical in-memory document
            (Zustand: configStore) (types.ts)
                 │        │
   live editor ─┘        └─ export
                              │
            serializeKeymap() ─┴─► surface JSON (download / save)
                              │    (serialize.ts; preferredSourceJson keeps
                              │     your original spelling)
                              │
            getCompiler(target).compile(config) ─► ExportedFile[] + diagnostics
                              │                     (compiler.ts + compilers/*)
                              ▼
            buildProjectBundle(config, target) ─► full repo skeleton (.zip)
                                                   (bundle.ts)
```

The key invariant: **one canonical form**. `normalize` lowers every surface
shorthand (bare-string keys, `mod_tap`/`layer_tap` presets, `"Ctrl+C"` combo
strings) into explicit `CanonAction` nodes, so neither the live-edit path nor any
compiler ever branches on surface sugar. The config is never round-tripped
through the runtime `KeyAction` model — that projection is display-only and
lossy.

## Module map

| Concern                                      | File(s)                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Canonical types (source of truth)            | `types.ts`                                                                                                            |
| Surface Zod schema + validation              | `schema.ts`                                                                                                           |
| Surface → canonical                          | `normalize.ts`                                                                                                        |
| Canonical → surface (round-trip)             | `serialize.ts`                                                                                                        |
| Public barrel                                | `index.ts`                                                                                                            |
| Keycode catalog / resolution                 | `keycodes.ts`, `names.ts`                                                                                             |
| Compiler Strategy + registry                 | `compiler.ts`                                                                                                         |
| Per-firmware compilers                       | `compilers/zmk/`, `compilers/qmk.ts`, `compilers/viaJson.ts`, `compilers/vialJson.ts`, `compilers/qmkKeyboardJson.ts` |
| Capability gating                            | `capabilities.ts`                                                                                                     |
| Project bundle (repo skeleton + CI)          | `bundle.ts`                                                                                                           |
| `.conf` / `config.h` / `rules.mk` derivation | `firmwareConf.ts`                                                                                                     |
| Readiness checks                             | `completeness.ts`                                                                                                     |
| Matrix derivation                            | `matrix.ts`                                                                                                           |
| Controller / pins resolution                 | `controller.ts`, `pinmaps.ts`                                                                                         |
| Diagnostics                                  | `diagnostics.ts`                                                                                                      |
| JSON Schema generation                       | `jsonSchema.ts`                                                                                                       |
| Builder firmware target descriptors          | `firmwareTargets.ts`                                                                                                  |
| Defaults                                     | `defaults.ts`                                                                                                         |
| Vial UID/unlock helpers                      | `vial.ts`                                                                                                             |
| Editor palette metadata                      | `editorMeta.ts`                                                                                                       |
| Tests                                        | `__tests__/`                                                                                                          |

## Public surface

`index.ts` is a pure barrel — re-exports types, parsers (`parseSurface`,
`parseKeymap`), serializers, normalization, validation (`KeymapSchema`,
`buildConfigJsonSchema`), capabilities, matrix helpers, compilers
(`getCompiler`/`hasCompiler`/`registerCompiler`) and `buildProjectBundle`. The
two side-effect imports at the bottom register the concrete compilers:

```ts
import './compilers/zmk'
import './compilers/qmk'
```

## Next

- [Compilers](/dev/compilers) — the Strategy interface + how each emitter works
- [Adding a firmware target](/dev/adding-a-firmware-target)
