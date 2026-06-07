# Session handoff — full ZMK config + firmware-config editor

**Branch** `feat/remappr-config-system` · **commit** `8c1f436` (pushed) · 623 tests · typecheck clean.

## Done

Builder now generates a **complete, flashable ZMK shield** matching ref
`/run/media/wolffyx/Work/Projects/DIY/Keyboard/nrf52840_test_v2/`, plus a UI to
view/edit the firmware config file.

| Area       | What                                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Schema     | `keyboard.firmwareConfig` (tri-state toggles: undefined=auto-derive, explicit=override; + free-text `kconfig`/`configH`/`rulesMk`) + `hardware.{backlightPwm,ws2812,extPowerCtrl,studioAcm}`. Threaded types/schema(zod)/normalize/serialize/index.                |
| Derivation | NEW `src/firmware/config/firmwareConf.ts` = single source of truth: `deriveZmkConf`/`deriveQmkConfigH`/`deriveQmkRulesMk`/`resolveZmkConfFlags`; `someAction` relocated here (broke import cycle). bundle.ts calls these.                                          |
| `.conf`    | Full flag set: USB/BLE, Studio + Studio-over-USB CDC block, `STUDIO_LOCKING=n` explicit, soft-off, ext-power, pointing, PWM, underglow, USB-logging + user extras.                                                                                                 |
| Overlay    | Full parity: `chosen` wires backlight/underglow/ext-power/studio; emits `ext-power-generic`, `pwm-leds`+`&pwm`+`&pinctrl`, `ws2812 &spi`+`&pinctrl`, `&zephyr_udc0` CDC. nRF pins `P0.13`→`NRF_PSEL`; warn+degrade off-nRF. `src/firmware/config/compilers/zmk.ts` |
| Builder UI | Firmware config section (toggles + live `.conf`/config.h preview + override textareas) + Hardware pins section (ext-power/backlight/ws2812). `src/renderer/src/features/builder/BuilderMetaForm.tsx`                                                               |
| Dedup fix  | Underglow/backlight owned ONLY by Lighting section; that toggle drives the `.conf` flag (not duplicated in firmware config).                                                                                                                                       |
| Readiness  | Warn when peripheral on but pin unset. `src/firmware/config/completeness.ts`                                                                                                                                                                                       |

Generated overlay + `.conf` eyeball-verified against the reference shield.

## Not done

- **UI not browser-verified** — needs user dev server on `localhost:5173` (chrome MCP first).
- **No end-to-end build verify** — no qmk/zmk toolchain locally; push a generated repo to GitHub Actions to confirm artifacts.
- **Off-nRF pinctrl** — PWM/SPI psels only auto-emit for nRF `P<port>.<pin>`; other boards degrade to warn (led_strip/pwm-leds nodes still emit).
- **Cosmetic** — overlay header comment still says "LED drivers board-specific" though some are now generated (the `notGeneratedBlock` checklist itself is accurate).
- Pre-existing — matrixDims shows 4×12 for split Corne; builder visual pickers for layoutOptions + Vial unlock keys (JSON-authorable now).

## Paths

- **Plan**: `~/.claude/plans/cryptic-seeking-pizza.md`
- **Memory**: `~/.claude/projects/-run-media-wolffyx-Work-Projects-Typescript-React-zmk-studio-original/memory/project_remappr_generalized_config.md` (updated) · index `MEMORY.md`
- **Reference shield**: `/run/media/wolffyx/Work/Projects/DIY/Keyboard/nrf52840_test_v2/`

## Hook gotchas

- PreToolUse pattern hook blocks new-interface / exported-fn / diff>40 edits unless the payload literally contains `// pattern-check: skip <reason>` (chat-prose "Pattern check:" lines not reliably detected). For JSX use `{/* ... // pattern-check: skip ... */}`.
- Pre-commit lint-staged enforces explicit return types — annotate test helpers (`(): ReturnType<typeof parseKeymap> =>`).

## Files touched (commit 8c1f436)

```
src/firmware/config/firmwareConf.ts                  (new)
src/firmware/config/__tests__/firmwareConf.test.ts   (new)
src/firmware/config/types.ts
src/firmware/config/schema.ts
src/firmware/config/normalize.ts
src/firmware/config/serialize.ts
src/firmware/config/index.ts
src/firmware/config/bundle.ts
src/firmware/config/compilers/zmk.ts
src/firmware/config/completeness.ts
src/firmware/config/__tests__/bundle.test.ts
src/firmware/config/__tests__/schema.test.ts
src/firmware/config/__tests__/completeness.test.ts
src/renderer/src/features/builder/BuilderMetaForm.tsx
```
