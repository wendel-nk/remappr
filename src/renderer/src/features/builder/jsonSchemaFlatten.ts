// Pattern check: no GoF pattern (-) — rejected — pure recursive JSON-schema walker producing reference rows, plain functions over data, no abstraction warranted
//
// Schema-walk helpers extracted from JsonConfigPanel: flatten the zod-derived
// JSON Schema into demo-shaped reference rows for the "All options" tab.

export interface FieldRow {
    path: string
    depth: number
    type: string
    enumVals: string[] | null
    description: string
}

export type SchemaNode = Record<string, unknown>

/** Derive a demo-parity type label + any enum values for a schema node:
 *  const → its literal, enum → "enum", a union → "binding" (collecting the
 *  branch discriminants), an array → "array<item>". Mirrors the prototype's
 *  schemaTypeLabel so the reference reads the same. */
export function typeOf(ps: SchemaNode): {
    type: string
    enumVals: string[] | null
} {
    if ('const' in ps) return { type: JSON.stringify(ps.const), enumVals: null }
    if (Array.isArray(ps.enum))
        return { type: 'enum', enumVals: (ps.enum as unknown[]).map(String) }
    const union = (ps.anyOf ?? ps.oneOf) as SchemaNode[] | undefined
    if (union?.length) {
        const branches = union.filter((b) => b.type !== 'null')
        const enumBranch = branches.find((b) => Array.isArray(b.enum))
        if (enumBranch && branches.length === 1)
            return {
                type: 'enum',
                enumVals: (enumBranch.enum as unknown[]).map(String),
            }
        // A typed-action union: collect each branch's discriminant (a string
        // branch = a bare keycode; an object branch = its `type` const).
        const consts = branches
            .map((b) =>
                b.type === 'string'
                    ? 'keycode'
                    : (
                          (b.properties as SchemaNode | undefined)?.type as
                              | SchemaNode
                              | undefined
                      )?.const,
            )
            .filter(Boolean)
            .map(String)
        return { type: 'binding', enumVals: consts.length ? consts : null }
    }
    if (ps.type === 'array') {
        const items = ps.items as SchemaNode | undefined
        const it = items?.type as string | undefined
        return { type: `array${it ? `<${it}>` : ''}`, enumVals: null }
    }
    return { type: (ps.type as string) ?? '', enumVals: null }
}

/** Flatten the JSON Schema into demo-shaped reference rows (depth-capped). Walks
 *  object properties, array-of-object items, and array-of-union (binding) items. */
export function flattenSchema(
    node: SchemaNode,
    prefix = '',
    depth = 0,
    out: FieldRow[] = [],
): FieldRow[] {
    if (depth > 4) return out
    const props = node.properties as Record<string, SchemaNode> | undefined
    if (!props) return out
    for (const [key, ps] of Object.entries(props)) {
        const path = prefix ? `${prefix}.${key}` : key
        const { type, enumVals } = typeOf(ps)
        out.push({
            path,
            depth,
            type,
            enumVals,
            description: (ps.description as string) ?? '',
        })
        if (ps.properties) {
            flattenSchema(ps, path, depth + 1, out)
        } else if (ps.type === 'array') {
            const items = ps.items as SchemaNode | undefined
            if (items?.properties) {
                flattenSchema(items, `${path}[]`, depth + 1, out)
            } else if (items && (items.anyOf || items.oneOf)) {
                const { type: t, enumVals: e } = typeOf(items)
                out.push({
                    path: `${path}[]`,
                    depth: depth + 1,
                    type: t,
                    enumVals: e,
                    description:
                        'A keycode string, or a typed action object ({ "type": … }).',
                })
            }
        }
    }
    return out
}
