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
import {
    Check,
    Code2,
    Layers,
    RotateCcw,
    Search,
    TriangleAlert,
    X,
} from 'lucide-react'
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
    type: string
    description: string
}

/** Flatten the JSON Schema into "path · type · description" rows (depth-capped)
 *  for the reference tab. Walks object properties + array item shapes. */
function flattenSchema(
    node: Record<string, unknown>,
    prefix = '',
    depth = 0,
    out: FieldRow[] = [],
): FieldRow[] {
    if (depth > 4) return out
    const props = node.properties as
        | Record<string, Record<string, unknown>>
        | undefined
    if (!props) return out
    for (const [key, raw] of Object.entries(props)) {
        let child = raw
        // Unwrap a oneOf/anyOf wrapper to its first concrete branch for display.
        const union = (child.anyOf ?? child.oneOf) as
            | Record<string, unknown>[]
            | undefined
        if (union?.length) child = union[0]
        const path = prefix ? `${prefix}.${key}` : key
        const type = (child.type as string) ?? (child.enum ? 'enum' : 'any')
        out.push({
            path,
            type,
            description: (child.description as string) ?? '',
        })
        if (child.type === 'object') {
            flattenSchema(child, path, depth + 1, out)
        } else if (
            child.type === 'array' &&
            (child.items as Record<string, unknown>)?.properties
        ) {
            flattenSchema(
                child.items as Record<string, unknown>,
                `${path}[]`,
                depth + 1,
                out,
            )
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
    const [issues, setIssues] = useState<{ count: number; line: number }>({
        count: 0,
        line: 0,
    })
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
            const line = errs.length
                ? Math.min(...errs.map((m) => m.startLineNumber))
                : 0
            setIssues({ count: errs.length, line })
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

    const tabBtn = (
        value: 'json' | 'options',
        label: string,
        Icon: typeof Code2,
    ): JSX.Element => (
        <button
            type="button"
            onClick={() => setTab(value)}
            className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-bold transition-colors ${
                tab === value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
            }`}
        >
            <Icon size={13} />
            {label}
        </button>
    )

    return (
        <div className="flex h-full flex-col">
            {/* header */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <div className="flex items-center gap-1">
                    {tabBtn('json', 'Editor', Code2)}
                    {tabBtn('options', 'All options', Layers)}
                </div>
                <div className="ml-auto flex items-center gap-1">
                    <button
                        type="button"
                        aria-label="Reset to current config"
                        onClick={onReset}
                        className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                        <RotateCcw size={14} />
                    </button>
                    <button
                        type="button"
                        aria-label="Close JSON panel"
                        onClick={onClose}
                        className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                        <X size={15} />
                    </button>
                </div>
            </div>

            {tab === 'json' ? (
                <>
                    {/* prominent validation status (design parity) */}
                    <div
                        className={`flex items-center gap-1.5 border-b border-border px-3 py-1.5 text-[11.5px] font-semibold ${
                            issues.count || error
                                ? 'text-destructive'
                                : 'text-emerald-500'
                        }`}
                    >
                        {issues.count || error ? (
                            <>
                                <TriangleAlert size={13} />
                                {issues.count
                                    ? `${issues.count} issue${issues.count > 1 ? 's' : ''} · line ${issues.line}`
                                    : 'Invalid JSON'}
                            </>
                        ) : (
                            <>
                                <Check size={13} />
                                Valid · matches schema · applied live
                            </>
                        )}
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
                    <div className="border-t border-border px-3 py-2 text-[11.5px] text-muted-foreground">
                        Ctrl/⌘+Space for suggestions · invalid values are
                        underlined · edits sync to the canvas
                    </div>
                </>
            ) : (
                <>
                    {/* pattern-check: skip — presentational searchable options list, no logic */}
                    <div className="border-b border-border p-2.5">
                        <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-2.5 py-1.5">
                            <Search
                                size={13}
                                className="shrink-0 text-muted-foreground"
                            />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search config options…"
                                className="w-full bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
                            />
                        </div>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-3">
                        <ul className="space-y-1.5">
                            {fields.map((f) => {
                                const depth = (f.path.match(/[.[]/g) ?? [])
                                    .length
                                return (
                                    <li key={f.path}>
                                        <button
                                            type="button"
                                            onClick={() => insertField(f.path)}
                                            title="Insert at cursor"
                                            style={{ marginLeft: depth * 10 }}
                                            className="w-full rounded-lg border border-border bg-background p-2.5 text-left transition-colors hover:border-primary"
                                        >
                                            <div className="flex items-baseline gap-2">
                                                <code className="font-mono text-[12px] font-semibold text-foreground">
                                                    {f.path.split(/[.[]/).pop()}
                                                </code>
                                                <span className="rounded bg-secondary px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
                                                    {f.type}
                                                </span>
                                            </div>
                                            {f.description && (
                                                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                                                    {f.description}
                                                </p>
                                            )}
                                        </button>
                                    </li>
                                )
                            })}
                            {!fields.length && (
                                <li className="px-1 py-4 text-center text-[12px] text-muted-foreground">
                                    No options match “{search}”.
                                </li>
                            )}
                        </ul>
                    </div>
                </>
            )}
        </div>
    )
}
