# Building the layout

The **layout** is the set of physical keys — their position, size and rotation —
plus the **matrix** that says how each key is wired electrically. Both feed the
firmware export and both live under `keyboard` in the
[config](/reference/config/keymap-format#keyboard).

::: info 📷 Screenshot slot — `docs/public/images/builder/build-from.png`
The left panel's **Build from** row (Presets · Import KLE · Make grid · Add key)
with a board on the canvas.
:::

## Create the geometry

The **Build from** section has four entry points. The **Start a keyboard** dialog
(_"Design a keyboard — pick a starting point"_) offers the same three starting
points plus "Start blank".

| Tool           | Dialog                                                      | What it does                                                         |
| -------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| **Presets**    | _"Start from a preset — replaces the current board layout"_ | Pick a known layout (Corne, ortho, 60%, numpad, macropad…).          |
| **Import KLE** | _"Import from KLE — keyboard-layout-editor.com raw data"_   | Paste the **Raw data** from KLE's Download menu → **Import layout**. |
| **Make grid**  | _"Make a grid — Ortholinear rows × columns"_                | Set **Rows** / **Columns** → **Create R×C grid**.                    |
| **Add key**    | —                                                           | Drop a single 1U key onto the canvas.                                |

The first three **replace** the geometry (layer names kept, bindings reset to
pass-through); **Add key** is additive.

::: tip KLE imports
_"Imports key positions & sizes only — legends and matrix wiring are assigned in
the builder."_ So after a KLE import, wire the matrix and assign bindings here.
:::

## Position keys on the canvas

- **Drag** a key to move it; selected keys move together.
- **Marquee** — drag on empty canvas to box-select; `Cmd/Ctrl + A` selects all.
- **Arrow keys** nudge 0.25U (hold **Shift** for 1U).
- `Cmd/Ctrl + D` duplicates; `Delete` / `Backspace` removes.
- **Undo/Redo** covers every geometry edit.

### Snapping

The toolbar **snap mode** switches **Snap to grid** ⟷ **Free form**; the snapping
toggle enables ⅛U snapping while dragging/resizing (status bar shows `snap ⅛U` /
`snap off` / `free-form`).

### What a key looks like in the config

Each key is a [`CanonGeometry`](/reference/config/keymap-format#keyboard). A plain
1U key is just its position — defaulted `w`/`h`/`r` are omitted:

```json
{ "x": 3, "y": 1 }
```

A wider, rotated, matrix-wired thumb key carries the extra fields:

```json
{
    "x": 3.5,
    "y": 3.2,
    "w": 1.5,
    "r": 15,
    "rx": 3.5,
    "ry": 3.2,
    "matrix": [3, 5]
}
```

| Field      | Inspector label        | Meaning                                  |
| ---------- | ---------------------- | ---------------------------------------- |
| `x`, `y`   | X / Y                  | Position in key units (U).               |
| `w`, `h`   | Width / Height         | Size in U (default 1).                   |
| `r`        | Angle °                | Rotation.                                |
| `rx`, `ry` | Pivot X / Pivot Y      | Rotation origin.                         |
| `matrix`   | Row / Column           | Electrical position `[row, col]`.        |
| `pin`      | Direct GPIO pin        | Per-key direct GPIO (direct-pin boards). |
| `element`  | Key / Encoder / Slider | Input element type.                      |

The inspector edits all of these — see [Key inspector](/guide/builder/inspector).

## Wire the matrix

Firmware needs the **electrical row and column** of each key. Two ways to set it:

1. **Matrix-wiring overlay** (toolbar **Matrix wiring view**) — shows the grid
   with editable **pin chips** ("Click to set the GPIO pin"); add rows/cols with
   the **Add a matrix row** / **Add a matrix column** buttons.
2. **Per key**, in the inspector's **Matrix wiring · row / column** section.

The Identity panel's **Matrix** section sets the dimensions and has an **Auto**
button — _"Auto assigns each key's row/column from its position"_:

```json
"keyboard": {
  "matrix": { "rows": 4, "cols": 12, "diodeDirection": "col2row", "mode": "matrix" },
  "pins":   { "rows": ["GP4","GP5","GP6","GP7"], "cols": ["GP8","GP9","…"] }
}
```

- When a key's `matrix` is set, it is **authoritative**.
- When absent, the compiler **derives** it from physical position.

::: warning Matrix vs geometry
Physical position is not electrical wiring. For a board you intend to flash, set
the real `[row, col]` per key (or supply a [kscan + transform](/reference/config/hardware))
and re-check the generated map before flashing.
:::

## Next

[Key inspector →](/guide/builder/inspector)
