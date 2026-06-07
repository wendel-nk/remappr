# Handoff — ZMK lighting (make the RGB sheet reflect ZMK's real capabilities)

Branch: `feat/remappr-config-system`.

## Problem

The RGB sheet was built around the QMK/Keychron model (live HID get/set of
effect, per-key colours, indicators). **ZMK works differently** and currently the
sheet doesn't represent it accurately:

- ZMK exposes **no `rgb` member** on its `KeyboardService` (grep: `src/firmware/zmk/`
  has no `RgbApi`). So the sheet's `DeviceRgbControls` never render for ZMK; it
  falls back to the `SimulationPanel` (client-side glow only) for Backlight and
  shows coming-soon for the rest. That's not wrong, but it's not the real story.
- ZMK lighting is **not editable live over the Studio protocol** today. There is
  no ZMK Studio RGB get/set channel. RGB underglow + backlight are:
    1. **Runtime behaviors** bound to keys — `&rgb_ug` / `&bl` — already modeled:
       `src/firmware/zmk/raise.ts` (`RGB_CMD` map: toggle/on/off/hue/sat/bri/speed/
       effect-next/prev), `displayNameToBinding.ts`, and emitted by `export.ts`
       (`dt-bindings/zmk/rgb.h`, `backlight.h`, `CONFIG_ZMK_RGB_UNDERGLOW=y`).
    2. **Compile-time config** — initial effect/hue/sat/brightness and whether
       underglow/backlight are enabled, set in the buildable config and baked into
       firmware at build.

## What "changed accordingly" should mean

Don't bolt a fake live-RGB API onto ZMK. Instead make the UI honest about the
two things ZMK can actually do:

1. **Config-time lighting defaults (primary).** Surface underglow/backlight in
   the generalized buildable config so "Export & build" emits the right
   `CONFIG_ZMK_RGB_UNDERGLOW` / backlight settings + initial HSV/effect. The glow
   simulation should preview these defaults (the lighting engine already drives a
   glow from `meta.lighting` for the builder — reuse that path; see
   `features/lighting/engine.ts` and `project_lighting_sim`).
    - Catalog already exists: `ZMK_UNDERGLOW_CATALOG` / `ZMK_UNDERGLOW_EFFECTS`
      (Solid/Breathe/Spectrum/Swirl) in `src/firmware/lighting.ts`.
2. **Behavior binding (already works).** `&rgb_ug` / `&bl` actions are bindable to
   keys via the normal keymap editor — keep, maybe expose a friendlier picker.

### Sheet behavior per firmware (target)

- **ZMK**: Backlight/Underglow sections edit the **config defaults** (not live),
  with a clear "applies on next build/flash" note + glow preview. Per-key / Mix /
  Indicator: hidden or coming-soon (ZMK underglow is strip-wide, not per-key;
  RGB-matrix per-key needs `CONFIG_ZMK_RGB_..._MATRIX` which most ZMK boards
  don't ship). No live-write controls.
- **QMK/Keychron**: unchanged (live HID).

## How to implement (sketch)

- Keep gating on capability, not firmware name. Two clean options:
    1. Add an optional `RgbConfigApi` (config-time) to `service.ts` distinct from
       the live `RgbApi`; ZMK implements `RgbConfigApi`, QMK implements `RgbApi`.
       The sheet picks live controls when `rgb` is present, config controls when
       `rgbConfig` is present.
    2. Or drive ZMK lighting purely through the generalized-config editor (builder)
       and have the sheet show a read-only "configured at build" summary + glow for
       a connected ZMK board.
- Reuse `ZMK_UNDERGLOW_CATALOG` for the effect list; reuse the `ColorPicker` and
  the glow engine for preview.
- Export already handles the keymap/behavior side; the gap is config-default
  emission + a UI to set them.

## Plan paths / memory

- `~/.claude/plans/remappr-generalized-buildable-config.md` (where lighting config
  belongs — buildable per-target output).
- `~/.claude/plans/remappr-build-and-flash-pipeline.md` ("applies on next build").
- Memory: `project_zmk_parity`, `project_remappr_generalized_config`,
  `project_lighting_sim`, `project_keychron_launcher_parity`.

## Definition of done

- A connected/ builder ZMK board shows underglow/backlight **config** controls
  (effect from `ZMK_UNDERGLOW_EFFECTS`, HSV, enable) with a glow preview and an
  "applies on next build" note — no fake live writes.
- Export emits matching `CONFIG_ZMK_RGB_UNDERGLOW` / backlight + initial values.
- Per-key/Mix/Indicator correctly hidden for ZMK. typecheck + tests + lint green.
