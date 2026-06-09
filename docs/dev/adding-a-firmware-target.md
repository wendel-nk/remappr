# Adding a firmware target

A new firmware is a new [Strategy](/dev/compilers): implement `KeymapCompiler`,
register it, declare its capabilities, and wire up the bundle. The canonical
`ConfigKeymap` already gives you a fully-normalized document — you only write the
lowering.

The steps below assume a new target — call it `myfw`.

## 1. Add the target id

`Target` is the compiler-target union in `types.ts`:

```ts
export type Target = 'zmk' | 'qmk' | 'keychron' | 'myfw'
```

TypeScript will now flag every exhaustive switch and `Record<Target, …>` that
needs a new arm — `CAPABILITY_MATRIX`, defaults, etc. Work through them.

## 2. Implement the compiler

Create `compilers/myfw.ts` (or a `compilers/myfw/` dir if it needs submodules).
Write an emit function and register the strategy:

```ts
import { runCompile, registerCompiler, type KeymapCompiler } from '../compiler'
import type { ExportedFile } from '../../types'
import type { DiagnosticBag } from '../diagnostics'
import type { ConfigKeymap } from '../types'

function emit(config: ConfigKeymap, diag: DiagnosticBag): ExportedFile[] {
    // lower config.layers[].bindings (CanonAction) to your firmware's format;
    // push a diag.warn(...) and emit a no-op for anything you can't support yet.
    return [
        /* ExportedFile[] */
    ]
}

const compiler: KeymapCompiler = {
    target: 'myfw',
    compile: (config) => runCompile(config, emit),
}

registerCompiler(compiler)
```

Lean on the existing helpers: keycode spellings from `keycodes.ts` / `names.ts`,
matrix from `matrix.ts` (`materializeMatrix` / `deriveMatrix`), controller from
`controller.ts`, pins from `pinmaps.ts`.

## 3. Register it on load

Add the side-effect import to the barrel so the compiler self-registers:

```ts
// src/firmware/config/index.ts
import './compilers/zmk'
import './compilers/qmk'
import './compilers/myfw' // [!code ++]
```

## 4. Declare capabilities

Add a `myfw` arm to `CAPABILITY_MATRIX` in `capabilities.ts` — the lighting axes,
output actions and behaviors your firmware can actually codegen. Compilers
consult this to gate features (warn + no-op) instead of scattering
`if (target === …)` checks. Update `resolveAllowedTargets` if the target maps to
a connected-device firmware family.

## 5. Make it selectable & buildable

- **`firmwareTargets.ts`** — add a `BuilderFirmwareTarget` descriptor (id, name,
  blurb, `wireless`) so the builder's Identity panel offers it.
- **`bundle.ts`** — add a branch in `buildProjectBundle` that wraps your
  compiler's files in a repo skeleton + CI workflow + README. Reuse the existing
  ZMK/QMK bundle functions as a template.
- **`completeness.ts`** — add the readiness checks (what must be set before the
  generated project builds).
- **`firmwareConf.ts`** — derive any per-firmware config files if needed.

## 6. Test

Add fixtures and tests under `src/firmware/config/__tests__/`. The existing
`compiler.test.ts` / `bundle.test.ts` show the shape: compile the demo config,
assert on the emitted files and diagnostics. Run:

```sh
pnpm test
pnpm typecheck
```

## Checklist

- [ ] `Target` union extended (`types.ts`)
- [ ] Compiler implemented + `registerCompiler` called
- [ ] Side-effect import added to `index.ts`
- [ ] `CAPABILITY_MATRIX` arm added
- [ ] Builder descriptor in `firmwareTargets.ts`
- [ ] `buildProjectBundle` branch + readiness checks
- [ ] Tests + `pnpm typecheck` green
