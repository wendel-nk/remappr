// Pattern check: no GoF pattern (-) — rejected — Monaco editor wrapper with
// debounced two-way config sync + a schema-walk reference list; presentational
// glue over existing parse/serialize seams, no abstraction warranted.
//
// The builder's live JSON config panel (Phase 8), ported from the prototype
// (BuilderPanels.jsx JsonConfigPanel + MonacoEditor.jsx). It docks where the
// inspector normally sits and edits the SAME config (source of truth):
//   • config → editor: re-serialize when the config changes and the editor is
//     NOT focused (so canvas edits show up, but never clobber active typing).
//   • editor → config: debounced parseKeymap via configStore.loadFromSource;
//     invalid JSON surfaces as the store's parse error + Monaco's own squiggles.
// The JSON language service validates + autocompletes against the zod-derived
// schema (buildConfigJsonSchema). An "All options" tab lists every field's
// describe() text as a reference.
import { useEffect, useMemo, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { Check, Code2, Flame, Layers, RotateCcw, Search, X } from 'lucide-react'
import { buildConfigJsonSchema, serializeKeymap } from '@firmware/config'
import useConfigStore from '@/stores/configStore'
import { monaco } from './monacoSetup'

const DEBOUNCE_MS = 400
const SCHEMA_URI = 'inmemory://remappr/keymap-schema.json'

/** Track the app's resolved dark/light so Monaco's theme follows it. */
function useIsDark(): boolean {
    const [dark, setDark] = useState(
        () =>
            typeof document !== 'undefined' &&
            document.documentElement.classList.contains('dark'),
    )
    useEffect(() => {
        const root = document.documentElement
        const obs = new MutationObserver(() =>
            setDark(root.classList.contains('dark')),
        )
        obs.observe(root, { attributes: true, attributeFilter: ['class'] })
        return () => obs.disconnect()
    }, [])
    return dark
}

// pattern-check: skip — local typed shim over monaco 0.55's deprecated-typed
// json defaults; runtime path unchanged, no abstraction.
// monaco-editor 0.55 deprecated the *types* on `languages.json` but the runtime
// defaults object is unchanged — the main bundle still wires it. Reach it
// through a local typed shim so validation works without an `any`.
interface JsonDiagnosticsOptions {
    validate?: boolean
    allowComments?: boolean
    schemas?: Array<{ uri: string; fileMatch?: string[]; schema?: unknown }>
}
interface JsonDefaults {
    setDiagnosticsOptions(options: JsonDiagnosticsOptions): void
}

/** Install the config JSON Schema into Monaco's JSON language service once, so
 *  every JSON model gets validation + Ctrl/Cmd+Space autocomplete against it. */
function installSchema(): void {
    const jsonDefaults = (
        monaco.languages as unknown as {
            json: { jsonDefaults: JsonDefaults }
        }
    ).json.jsonDefaults
    jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemas: [
            {
                uri: SCHEMA_URI,
                fileMatch: ['*'],
                schema: buildConfigJsonSchema(),
            },
        ],
    })
}

interface FieldRow {
    path: string
    depth: number
    type: string
    enumVals: string[] | null
    description: string
}

type SchemaNode = Record<string, unknown>

/** Derive a demo-parity type label + any enum values for a schema node:
 *  const → its literal, enum → "enum", a union → "binding" (collecting the
 *  branch discriminants), an array → "array<item>". Mirrors the prototype's
 *  schemaTypeLabel so the reference reads the same. */
function typeOf(ps: SchemaNode): { type: string; enumVals: string[] | null } {
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
function flattenSchema(
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

interface JsonConfigPanelProps {
    onClose: () => void
}

export function JsonConfigPanel({
    onClose,
}: JsonConfigPanelProps): JSX.Element {
    const config = useConfigStore((s) => s.config)
    const error = useConfigStore((s) => s.error)
    const loadFromSource = useConfigStore((s) => s.loadFromSource)
    const isDark = useIsDark()

    const [tab, setTab] = useState<'json' | 'options'>('json')
    const [text, setText] = useState<string>(() =>
        config ? serializeKeymap(config) : '',
    )
    const [search, setSearch] = useState('')
    // Schema-validation summary, derived from Monaco's JSON markers.
    const [issues, setIssues] = useState<{
        count: number
        line: number
        message: string
    }>({ count: 0, line: 0, message: '' })
    const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)
    const focused = useRef(false)
    const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

    // config → editor: reflect external (canvas) edits, but only while the user
    // isn't typing here, so we never overwrite an in-progress edit.
    useEffect(() => {
        if (!focused.current && config) setText(serializeKeymap(config))
    }, [config])

    useEffect(
        () => () => {
            if (debounce.current) clearTimeout(debounce.current)
        },
        [],
    )

    const onMount: OnMount = (editor) => {
        installSchema()
        editorRef.current = editor
        // @monaco-editor/react exposes no focus/blur props — listen on the
        // editor instance so config→editor refresh never clobbers live typing.
        editor.onDidFocusEditorText(() => {
            focused.current = true
        })
        editor.onDidBlurEditorText(() => {
            focused.current = false
            // On blur, snap the editor back to the canonical serialization of
            // whatever the config now is (drops half-typed invalid text).
            const cfg = useConfigStore.getState().config
            if (cfg) setText(serializeKeymap(cfg))
        })
        // Surface the JSON language service's schema-validation markers as a
        // visible status, with the first error line.
        const model = editor.getModel()
        const refreshIssues = (): void => {
            if (!model) return
            const errs = monaco.editor
                .getModelMarkers({ resource: model.uri })
                .filter((m) => m.severity >= monaco.MarkerSeverity.Warning)
            const first = errs.length
                ? errs.reduce((a, b) =>
                      a.startLineNumber <= b.startLineNumber ? a : b,
                  )
                : null
            setIssues({
                count: errs.length,
                line: first?.startLineNumber ?? 0,
                message: first?.message ?? '',
            })
        }
        monaco.editor.onDidChangeMarkers(refreshIssues)
        refreshIssues()
    }

    /** Insert a field name at the cursor (All-options click) + focus the editor. */
    const insertField = (path: string): void => {
        const editor = editorRef.current
        if (!editor) return
        const leaf = path.split(/[.[]/).filter(Boolean).pop() ?? path
        const sel = editor.getSelection()
        if (sel) {
            editor.executeEdits('insert-field', [
                { range: sel, text: `"${leaf}": `, forceMoveMarkers: true },
            ])
        }
        editor.focus()
        setTab('json')
    }

    // editor → config: debounce, then try to parse. loadFromSource updates the
    // config (canvas follows) on success or sets the store error on failure.
    const onChange = (value?: string): void => {
        const next = value ?? ''
        setText(next)
        if (debounce.current) clearTimeout(debounce.current)
        debounce.current = setTimeout(() => {
            loadFromSource(next)
        }, DEBOUNCE_MS)
    }

    const onReset = (): void => {
        if (config) {
            const fresh = serializeKeymap(config)
            setText(fresh)
            loadFromSource(fresh)
        }
    }

    const allFields = useMemo(
        () => (tab === 'options' ? flattenSchema(buildConfigJsonSchema()) : []),
        [tab],
    )
    const fields = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return allFields
        return allFields.filter(
            (f) =>
                f.path.toLowerCase().includes(q) ||
                f.description.toLowerCase().includes(q),
        )
    }, [allFields, search])

    // Three-tone validation status (design parity): a hard parse error from the
    // store is destructive; Monaco's schema markers are an amber "schema issue";
    // otherwise green/valid. Exact tones + tinted backgrounds match the prototype.
    const status = error
        ? {
              color: 'var(--destructive)',
              bg: 'color-mix(in oklch, var(--destructive) 9%, transparent)',
              Icon: X,
              msg: 'Invalid JSON · not applied',
          }
        : issues.count
          ? {
                color: 'oklch(0.78 0.15 75)',
                bg: 'color-mix(in oklch, oklch(0.78 0.15 75) 10%, transparent)',
                Icon: Flame,
                msg: `${issues.count} schema issue${issues.count === 1 ? '' : 's'} · L${issues.line}: ${issues.message}`,
            }
          : {
                color: 'oklch(0.72 0.16 152)',
                bg: 'color-mix(in oklch, oklch(0.72 0.16 152) 8%, transparent)',
                Icon: Check,
                msg: 'Valid · matches schema · applied live',
            }

    const tabBtn = (
        value: 'json' | 'options',
        label: string,
        Icon: typeof Code2,
    ): JSX.Element => (
        <button
            type="button"
            onClick={() => setTab(value)}
            className={`inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[12px] font-bold transition-colors ${
                tab === value
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:text-foreground'
            }`}
        >
            <Icon size={13} />
            {label}
        </button>
    )

    return (
        <div className="flex h-full flex-col">
            {/* header — title block + actions */}
            <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
                <Code2 size={15} className="shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold">Config JSON</div>
                    <div className="text-[10.5px] text-muted-foreground">
                        Schema-checked · autocomplete · live-updates
                    </div>
                </div>
                <button
                    type="button"
                    aria-label="Re-sync from the board"
                    title="Re-sync from the board"
                    onClick={onReset}
                    className="grid size-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                    <RotateCcw size={14} />
                </button>
                <button
                    type="button"
                    aria-label="Close JSON panel"
                    onClick={onClose}
                    className="grid size-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                    <X size={15} />
                </button>
            </div>

            {/* tab bar */}
            <div className="flex gap-1 border-b border-border bg-card p-1.5">
                {tabBtn('json', 'Editor', Code2)}
                {tabBtn('options', 'All options', Layers)}
            </div>

            {tab === 'json' ? (
                <>
                    {/* prominent three-tone validation status */}
                    <div
                        className="flex items-center gap-1.5 border-b border-border px-3.5 py-2 text-[11.5px] font-semibold"
                        style={{ color: status.color, background: status.bg }}
                    >
                        <status.Icon size={13} className="shrink-0" />
                        <span className="truncate">{status.msg}</span>
                    </div>
                    <div className="min-h-0 flex-1">
                        <Editor
                            language="json"
                            theme={isDark ? 'vs-dark' : 'light'}
                            value={text}
                            onChange={onChange}
                            onMount={onMount}
                            options={{
                                minimap: { enabled: false },
                                fontSize: 12.5,
                                lineNumbers: 'on',
                                scrollBeyondLastLine: false,
                                tabSize: 2,
                                automaticLayout: true,
                                fixedOverflowWidgets: true,
                            }}
                        />
                    </div>
                    <div className="border-t border-border px-3.5 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
                        Press{' '}
                        <strong className="text-foreground">
                            Ctrl/⌘+Space
                        </strong>{' '}
                        for field &amp; value suggestions. Invalid values are
                        underlined. See{' '}
                        <strong className="text-foreground">All options</strong>{' '}
                        for the full reference.
                    </div>
                </>
            ) : (
                <>
                    {/* pattern-check: skip — presentational searchable options list, no logic */}
                    <div className="border-b border-border px-3.5 py-2.5">
                        <div className="relative">
                            <Search
                                size={14}
                                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                            />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search config options…"
                                className="w-full rounded-lg border border-input bg-background py-1.5 pl-8 pr-2.5 text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                            />
                        </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3.5 pt-1.5">
                        {fields.map((f) => {
                            const seg =
                                f.path.split(/[.[]/).filter(Boolean).pop() ??
                                f.path
                            return (
                                <button
                                    key={f.path}
                                    type="button"
                                    onClick={() => insertField(f.path)}
                                    title={`Insert "${seg}" at cursor`}
                                    style={{ paddingLeft: 8 + f.depth * 13 }}
                                    className="block w-full cursor-pointer rounded-md border-b border-border/50 py-1.5 pr-2 text-left transition-colors hover:bg-accent"
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-[12.5px] font-bold text-foreground">
                                            {seg}
                                        </span>
                                        {f.type && (
                                            <span
                                                className="rounded px-1.5 py-px font-mono text-[10px] font-bold"
                                                style={{
                                                    background:
                                                        'color-mix(in oklch, var(--primary) 14%, var(--background))',
                                                    color: 'var(--primary)',
                                                }}
                                            >
                                                {f.type}
                                            </span>
                                        )}
                                    </div>
                                    {f.enumVals && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {f.enumVals.map((v) => (
                                                <span
                                                    key={v}
                                                    className="rounded border border-border bg-secondary px-1.5 py-px font-mono text-[10.5px] text-muted-foreground"
                                                >
                                                    {v}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {f.description && (
                                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                                            {f.description}
                                        </p>
                                    )}
                                </button>
                            )
                        })}
                        {!fields.length && (
                            <div className="px-1 py-6 text-center text-[12.5px] text-muted-foreground">
                                No options match “{search}”.
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
