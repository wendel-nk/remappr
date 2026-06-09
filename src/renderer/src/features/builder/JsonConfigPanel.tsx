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
import { Check, Code2, Flame, Layers, RotateCcw, X } from 'lucide-react'
import {
    buildConfigJsonSchema,
    safeParseSurface,
    serializeKeymap,
} from '@firmware/config'
import useConfigStore from '@/stores/configStore'
import { useIsDark } from '@/hooks/use-dark-mode'
import { monaco } from './monacoSetup'
import { flattenSchema } from './jsonSchemaFlatten'
import { SchemaReferenceTab } from './SchemaReferenceTab'

const DEBOUNCE_MS = 400
const SCHEMA_URI = 'inmemory://remappr/keymap-schema.json'

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

// pattern-check: skip — mechanical removal of schema walkers now in jsonSchemaFlatten.ts
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
    // Set right before the panel's OWN loadFromSource so the resulting config
    // change doesn't bounce back and reshape the user's literal text (which
    // would strip explicitly-written defaults like `"w": 1`). Canvas-originated
    // config changes leave it false, so those DO refresh the editor.
    const selfEdit = useRef(false)
    const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

    /** Commit text to the config without the resulting change clobbering it. */
    const commit = (next: string): boolean => {
        selfEdit.current = true
        return loadFromSource(next)
    }

    // config → editor: reflect external (canvas) edits, but never overwrite the
    // user's in-progress typing or a change the panel itself just committed.
    useEffect(() => {
        if (selfEdit.current) {
            selfEdit.current = false
            return
        }
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
            // On blur, keep the user's literal text when it's valid (preserves
            // their formatting + explicitly-written defaults) and commit it.
            // Only snap back to canonical when the text is half-typed/invalid.
            const current = editor.getModel()?.getValue() ?? ''
            if (safeParseSurface(current).success) {
                commit(current)
            } else {
                const cfg = useConfigStore.getState().config
                if (cfg) setText(serializeKeymap(cfg))
            }
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
            commit(next)
        }, DEBOUNCE_MS)
    }

    const onReset = (): void => {
        if (config) {
            const fresh = serializeKeymap(config)
            setText(fresh)
            commit(fresh)
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
                // pattern-check: skip — inline JSX swapped for extracted SchemaReferenceTab child
                <SchemaReferenceTab
                    search={search}
                    setSearch={setSearch}
                    fields={fields}
                    insertField={insertField}
                />
            )}
        </div>
    )
}
