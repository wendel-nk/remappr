// Pattern check: no GoF pattern (-) — rejected — presentational floating variant
// chips (switch / add / inline-rename / delete) bound to configStore + builderStore;
// UI ported from app/builder/BuilderLayers.jsx (VariantBar), no abstraction.
/* eslint-disable jsx-a11y/no-autofocus, jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- variant chips are click/double-click select+rename targets; the rename input autofocuses by design. */
//
// The physical-layout variant bar, floated over the canvas. Variants let one board
// describe alternate key sets (e.g. split-spacebar vs 2u). Keys tag into a variant
// via CanonGeometry.variant (set in the inspector); selecting a chip here dims keys
// from other variants on the canvas. "All" clears the filter.
import { useState } from 'react'
import { Plus, Split, X } from 'lucide-react'
import useBuilderStore from '@/stores/builderStore'
import useConfigStore from '@/stores/configStore'
import { addLayout, removeLayout, renameLayout } from './builderInspectorOps'

export function VariantBar(): JSX.Element | null {
    const config = useConfigStore((s) => s.config)
    const active = useBuilderStore((s) => s.activeVariant)
    const setActive = useBuilderStore((s) => s.setActiveVariant)
    const commit = useBuilderStore((s) => s.commit)
    const [editing, setEditing] = useState<string | null>(null)
    const [draft, setDraft] = useState('')

    if (!config) return null
    const layouts = config.keyboard.layouts ?? []

    const onAdd = (): void => {
        const { config: next, id } = addLayout(config)
        commit(next)
        setActive(id)
    }
    const onDelete = (id: string): void => {
        commit(removeLayout(config, id))
        if (active === id) setActive('')
    }
    const commitRename = (id: string): void => {
        commit(renameLayout(config, id, draft))
        setEditing(null)
    }

    // A render helper (not a component) so it can close over editing/draft state
    // without tripping react-hooks/static-components.
    const chip = (id: string, label: string): JSX.Element => {
        const on = active === id
        return (
            <div
                key={id || 'all'}
                onClick={() => setActive(id)}
                className="flex cursor-pointer items-center gap-1.5 rounded-full py-[5px] pl-[11px] pr-[5px]"
                style={{
                    background: on ? 'var(--primary)' : 'var(--card)',
                    border: `1px solid ${on ? 'transparent' : 'var(--border)'}`,
                    color: on
                        ? 'var(--primary-foreground)'
                        : 'var(--foreground)',
                }}
            >
                {editing === id ? (
                    <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={() => commitRename(id)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename(id)
                            if (e.key === 'Escape') setEditing(null)
                        }}
                        className="w-[70px] rounded-md border border-primary bg-background px-1.5 py-0.5 text-[12px] font-semibold text-foreground outline-none"
                    />
                ) : (
                    <span
                        onDoubleClick={(e) => {
                            e.stopPropagation()
                            if (id !== '') {
                                setEditing(id)
                                setDraft(label)
                            }
                        }}
                        className="text-[12.5px] font-bold"
                    >
                        {label}
                    </span>
                )}
                {id !== '' && (
                    <button
                        type="button"
                        aria-label="Delete variant"
                        onClick={(e) => {
                            e.stopPropagation()
                            onDelete(id)
                        }}
                        className="grid size-[18px] place-items-center rounded-full text-current"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
        )
    }

    return (
        <div
            className="pointer-events-auto inline-flex items-center gap-[7px] rounded-full border border-border p-1.5 backdrop-blur-md"
            style={{
                background: 'color-mix(in oklch, var(--card) 92%, transparent)',
            }}
        >
            <span className="inline-flex items-center gap-1.5 pl-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                <Split size={13} /> Layout
            </span>
            {chip('', 'All')}
            {layouts.map((v) => chip(v.id, v.name))}
            <button
                type="button"
                onClick={onAdd}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-[5px] text-[12px] font-semibold text-foreground hover:border-primary"
            >
                <Plus size={13} /> Variant
            </button>
        </div>
    )
}
