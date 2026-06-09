# JSON Schema

Remappr's config has a machine-readable **JSON Schema** (Draft 2020-12). It is
generated from the same Zod schema that validates the config, so it never drifts
from the real shape, and it carries a description on every field.

## In the builder

The builder's **Edit JSON** panel is a Monaco editor wired to this schema. You
get, for free:

- **Live validation** — red squiggles on unknown keycodes, wrong types, missing
  required fields, out-of-range numbers.
- **Autocomplete** — `Ctrl`/`Cmd` + `Space` suggests fields and enum values,
  with the field's description as hover text.

This is the fastest way to hand-edit a config: the schema guides you as you type.

## In your own editor

You can get the same validation/autocomplete in VS Code (or any editor with a
JSON language server) by associating your `*.keymap.json` files with the schema.

The schema is generated at runtime from the app; the most reliable way to get a
copy is to **export your config from the builder** (the JSON download) and let
the in-app editor validate it. If you maintain configs outside the app, generate
the schema from the package:

```ts
import { buildConfigJsonSchema } from '@firmware/config'
import { writeFileSync } from 'node:fs'

// Draft 2020-12 JSON Schema for the keymap config.
writeFileSync(
    'remappr.schema.json',
    JSON.stringify(buildConfigJsonSchema(), null, 2),
)
```

Then point your editor at it, e.g. in `.vscode/settings.json`:

```json
{
    "json.schemas": [
        { "fileMatch": ["*.keymap.json"], "url": "./remappr.schema.json" }
    ]
}
```

## Notes on generation

- The schema describes what you **write** (the _input_ / surface form), so fields
  with a default — `w`, `h`, `r` on a key, etc. — are **optional**. A minimized
  config (defaults dropped) validates clean instead of flagging a missing
  property on every key.
- Generation is total: any construct Zod cannot express in JSON Schema
  (refinements, branded types) becomes an unconstrained `{}` rather than failing.
  So schema validation is best-effort — the authoritative validation is still the
  Zod parse the app runs on load (which also does cross-reference checks like
  layer-name and macro-ref resolution that a JSON Schema can't express).

## See also

- [Config overview](/reference/config/overview) — surface vs canonical, validation
- [Keymap format](/reference/config/keymap-format) — the fields the schema describes
