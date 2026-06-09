# Compilers

A **compiler** lowers the canonical `ConfigKeymap` directly to firmware artifacts
plus diagnostics. Each firmware is one implementation of a single interface,
swapped behind a registry — the [Strategy](https://refactoring.guru/design-patterns/strategy)
pattern.

## The interface

```ts
// src/firmware/config/compiler.ts
export interface CompileResult {
    files: ExportedFile[]
    diagnostics: Diagnostic[]
}

export interface KeymapCompiler {
    readonly target: Target // 'zmk' | 'qmk' | 'keychron'
    compile(config: ConfigKeymap): CompileResult
}
```

Helpers in the same file:

- `runCompile(config, emit)` — runs an emit function with a fresh
  `DiagnosticBag` and returns `{ files, diagnostics }`. Concrete compilers use
  this so they only have to write the emit logic.
- `registerCompiler(c)` / `getCompiler(target)` / `hasCompiler(target)` — the
  registry. `getCompiler` throws if no compiler is registered for the target.

## The registry

The registry is a `Map<Target, KeymapCompiler>` in `compiler.ts`. Each concrete
compiler module **self-registers** on load, and `index.ts` imports them for
their side effect:

```ts
// compilers/zmk/index.ts
registerCompiler({ target: 'zmk', compile: (c) => runCompile(c, emitKeymap) })

// index.ts (barrel)
import './compilers/zmk'
import './compilers/qmk'
```

The dependency direction is one-way (each compiler imports `compiler.ts`, never
the reverse), which avoids an import cycle.

## ZMK compiler

`compilers/zmk/` emits a devicetree `.keymap` plus a `.overlay` (or, for split
boards, a shared `.dtsi` and two half overlays). It is split into focused
submodules:

| Module         | Emits                                                                                  |
| -------------- | -------------------------------------------------------------------------------------- |
| `index.ts`     | Top-level assembly: `runCompile` entry + the `/ { … }` keymap node.                    |
| `bindings.ts`  | Per-binding lowering: a `CanonAction` → a ZMK behavior token (`&kp`, `&mt`, `&mo`, …). |
| `behaviors.ts` | Macros, tap-dances, mod-morphs, custom hold-tap defs, encoder sensors, slider inputs.  |
| `overlay.ts`   | Physical layout + `matrix-transform` (+ split overlays).                               |
| `hardware.ts`  | kscan, pinctrl, LED drivers, ext-power, split definitions.                             |
| `maps.ts`      | Sanitization helpers.                                                                  |

Behavior coverage tracks [zmk.dev/docs/keymaps/behaviors](https://zmk.dev/docs/keymaps/behaviors).
Hardware nodes (kscan, LED drivers, …) are only emitted when the config supplies
them; otherwise the overlay carries a "NOT GENERATED" checklist.

## QMK / VIA / Vial compilers

| Module                         | Emits                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `compilers/qmk.ts`             | `keymap.c` — the `keymaps[][MATRIX_ROWS][MATRIX_COLS]` table.                                                |
| `compilers/qmkKeyboardJson.ts` | `keyboard.json` — the data-driven board definition (matrix pins, diode, MCU/USB identity, features, layout). |
| `compilers/viaJson.ts`         | The VIA v3 definition (KLE keymap + row/col legend + per-key cap colors).                                    |
| `compilers/vialJson.ts`        | The Vial definition (wraps VIA with UID/unlock + macros/combos/key-overrides/tap-dance metadata).            |

VIA and Vial both build through the QMK family. The `keychron` target reuses the
QMK/VIA stack plus a BLE radio.

## Diagnostics & capability gating

Compilers don't fail on an unsupported feature — they record a `warn` diagnostic
and drop the binding to a no-op. The support data lives in `capabilities.ts`
(`CAPABILITY_MATRIX`) and is queried with `supportsLighting(target, axis)` /
`supportsOutput(target, action)`. Diagnostics accumulate in a `DiagnosticBag`
(`diagnostics.ts`) and surface in `CompileResult.diagnostics`.

## Project bundles

`bundle.ts` wraps a compiler's `ExportedFile[]` in a complete, ready-to-push repo
skeleton — `buildProjectBundle(config, target)` returns a `ProjectBundle`
(`{ files, diagnostics, rootName }`). ZMK → a `zmk-config` shield tree + `west.yml`

- `build.yaml` + a `build-user-config` workflow; QMK → a `qmk_userspace` tree +
  `qmk.json` + a `qmk_userspace_build` workflow. Both get a README with cloud +
  local build steps. The `.conf` / `config.h` / `rules.mk` are derived in
  `firmwareConf.ts`.

## Next

[Adding a firmware target →](/dev/adding-a-firmware-target)
