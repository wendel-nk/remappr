// pattern-check: skip — presentational searchable options list, no logic
//
// The "All options" tab of the JSON config panel: a searchable, click-to-insert
// reference list of every flattened schema field. Extracted verbatim from
// JsonConfigPanel; all state lives in the parent and is passed through.
import { Search } from 'lucide-react'
import type { FieldRow } from './jsonSchemaFlatten'

interface SchemaReferenceTabProps {
    search: string
    setSearch: (value: string) => void
    fields: FieldRow[]
    insertField: (path: string) => void
}

export function SchemaReferenceTab({
    search,
    setSearch,
    fields,
    insertField,
}: SchemaReferenceTabProps): JSX.Element {
    return (
        <>
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
                        f.path.split(/[.[]/).filter(Boolean).pop() ?? f.path
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
    )
}
