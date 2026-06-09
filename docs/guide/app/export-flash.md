# Export & flash

In the editor, the header's **Flash & export config** button (⤓) opens the
**Configuration Export** modal — _"Compile your keymap to firmware config."_ It
is the same export surface the builder uses, plus import and flash guidance.

::: info 📷 Screenshot slot — `docs/public/images/app/export-modal.png`
The Configuration Export modal — status line, the firmware **EXPORT** tabs, the
**IMPORT** button, and the numbered flash steps.
:::

## Status

A line at the top tells you what is loaded:

- `{n} layer(s) · source of truth` — a Remappr JSON config is loaded.
- `{FIRMWARE} device · native export` — a connected device with no config.
- `No config loaded · Connect a keyboard or import a .json config`.

## Export

With a config loaded, the **EXPORT** section shows the per-firmware
[project bundles](/guide/builder/export-build-flash#per-firmware-project-bundles)
— each downloadable as a ready-to-build project `.zip` (config + GitHub Actions
workflow + README), plus the raw Remappr JSON.

With a connected device but no config, you get a native export instead:
**Download {FIRMWARE} config** and **Copy**.

## Import

The **IMPORT** section's **Import .json** button loads a `.json`/`.txt` config.
Invalid files surface an inline _"Import: {error}"_.

## Flash to your keyboard

The modal lists the steps verbatim:

1. Download a firmware tab's **project (.zip)** for a ready-to-build repo (config
    - GitHub Actions workflow + README).
2. Push the project to a new GitHub repository.
3. GitHub Actions builds it automatically — or build locally per the README.
4. Download the firmware artifact and flash it to your keyboard.

For the full build/flash walkthrough (cloud vs local, UF2 vs DFU), see
[Export, build & flash](/guide/builder/export-build-flash).

## See also

- [JSON keymap config](/reference/config/overview)
- [Builder export](/guide/builder/export-build-flash)
