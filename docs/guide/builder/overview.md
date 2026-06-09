# Builder overview & toolbar

The Builder is a full-screen, canvas-based tool for designing a keyboard from
scratch — its physical layout, electrical matrix, controller, lighting, layers
and key bindings — and exporting it as a buildable firmware project.

Open it from the Start Page with **Create a keyboard** → **Open builder**.

::: info Access during development
While the builder is in alpha/beta it is **free** for everyone (a "{stage} · FREE"
badge shows on the Start Page card). At general availability it becomes a premium
feature that needs an account.
:::

::: info 📷 Screenshot slot — `docs/public/images/builder/overview.png`
The whole builder shell: toolbar across the top, the **Layers / Build from /
Identity** left panel, the keyboard on the canvas, and the inspector on the right.
:::

## The layout

```
┌──────────────────────────────────────────────────────────────┐
│  Toolbar                                                       │
├───────────────┬──────────────────────────────┬────────────────┤
│  Left panel   │                              │   Inspector     │
│  • Layers     │          Canvas              │  selected key   │
│  • Build from │      (pan / zoom keys)       │  properties     │
│  • Identity   │                              │  — or JSON —    │
├───────────────┴──────────────────────────────┴────────────────┤
│  Status bar   "12 selected"  ·  "snap ⅛U"  ·  "4×12 · 36 keys" │
└──────────────────────────────────────────────────────────────┘
```

## Toolbar reference

Left-to-right, with the exact tooltip each button shows:

| Button                | Tooltip                            | Does                                                             |
| --------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| ←                     | **Back**                           | Leave the builder.                                               |
| ▭                     | **Hide panel** / **Show panel**    | Collapse/expand the left panel.                                  |
| ▦                     | **Snap to grid** / **Free form**   | Switch placement mode.                                           |
| ⅛                     | **Snapping on** / **Snapping off** | Toggle ⅛U snapping while dragging.                               |
| ⊞                     | **Matrix wiring view**             | Overlay row/column wiring on the keys.                           |
| ↶                     | **Undo**                           | Undo the last edit.                                              |
| ↷                     | **Redo**                           | Redo.                                                            |
| `{ }`                 | **Edit config JSON**               | Swap the inspector for the live JSON editor.                     |
| ▤                     | **Keyboard library**               | Open saved boards.                                               |
| ?                     | **Replay builder tour**            | Re-run the guided coachmark tour.                                |
| ⚙                     | **Settings**                       | App settings.                                                    |
| ⤓                     | **Save to library**                | Save the current board to your library.                          |
| **Editor →**          |                                    | Hand off to the [keymap editor](/guide/editor) on a demo device. |
| **Export & build 🚀** |                                    | Open the [export modal](/guide/builder/export-build-flash).      |

The zoom cluster (**Zoom out** / **Reset view** / **Zoom in** / **Fit**) shows
the current zoom as a percentage (e.g. `100%`).

### Status bar

The bottom bar shows context:

- `12 selected` — when keys are selected.
- `Drag to marquee · Space/middle-drag to pan · scroll to zoom` — when nothing
  is selected.
- The current snap mode: `snap ⅛U`, `snap off`, or `free-form`.
- The board summary: `4×12 · 36 keys` (rows × cols, or `… per half` for splits).

## Left panel sections

| Section        | What it holds                                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Layers**     | The layer list (add / duplicate / delete / rename). See [Layers & bindings](/guide/builder/layers-and-bindings).                                                             |
| **Build from** | Create geometry: **Presets**, **Import KLE**, **Make grid**, **Add key**. See [Building the layout](/guide/builder/layout).                                                  |
| **Identity**   | The keyboard metadata form: name, USB ids, firmware targets, controller, matrix, lighting, firmware config. See [Identity & hardware](/guide/builder/identity-and-hardware). |

A reminder under the sections notes: _"Geometry & matrix are shared across all
layers."_ — only bindings differ per layer.

## Keyboard shortcuts

| Keys                                    | Action              |
| --------------------------------------- | ------------------- |
| `Ctrl/Cmd + Z`                          | Undo                |
| `Ctrl/Cmd + Shift + Z` · `Ctrl/Cmd + Y` | Redo                |
| `Ctrl/Cmd + A`                          | Select all keys     |
| `Ctrl/Cmd + D`                          | Duplicate selection |
| `Backspace` / `Delete`                  | Delete selection    |
| `Esc`                                   | Clear selection     |
| Arrow keys                              | Nudge 0.25U         |
| `Shift` + arrows                        | Nudge 1U            |

## How a design flows through Remappr

Everything you do edits one in-memory
**[JSON keymap config](/reference/config/overview)**. From there you can **Edit
JSON** (hand-edit the same config), hand it to the **Editor**, or **Export &
build** a per-firmware project.

## Next

[Build the layout →](/guide/builder/layout)
