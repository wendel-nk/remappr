// Pattern check: no GoF pattern (-) — rejected — presentational layers list
// (select / add / inline-rename / duplicate / delete) reading configStore +
// builderStore and committing pure layer transforms; UI component, no abstraction.
//
// The left-panel Layers list, ported from app/builder/BuilderLayers.jsx. Geometry
// + matrix are shared across layers (the builder only edits the physical board
// here); layers carry the per-key bindings, which a later phase will edit. Each
// layer gets a stable accent hue via layerAccent(); mutations route through
// builderStore.commit so they join the undo history.
/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/no-autofocus -- layer rows are click/double-click select+rename targets; the inline rename input autofocuses by design, matching the prototype. */
import { useState } from 'react'
import { Copy, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { layerAccent } from '@/lib/keymap/keyCategory'
import useBuilderStore from '@/stores/builderStore'
import useConfigStore from '@/stores/configStore'
import {
    addLayer,
    duplicateLayer,
    removeLayer,
    renameLayer,
} from './geometryEditor'

export function BuilderLayersPanel(): JSX.Element {
    const config = useConfigStore((s) => s.config)
    const active = useBuilderStore((s) => s.activeLayer)
    const setActive = useBuilderStore((s) => s.setActiveLayer)
    const commit = useBuilderStore((s) => s.commit)
    const [editing, setEditing] = useState<number | null>(null)
    const [draft, setDraft] = useState('')

    const layers = config?.layers ?? []

    const startRename = (i: number): void => {
        setEditing(i)
        setDraft(layers[i]?.name ?? '')
    }
    const commitRename = (): void => {
        if (editing == null || !config) return
        commit(renameLayer(config, editing, draft))
        setEditing(null)
    }
    const onAdd = (): void => {
        if (!config) return
        commit(addLayer(config))
        setActive(config.layers.length)
    }
    const onDuplicate = (i: number): void => {
        if (!config) return
        const { config: next, newIndex } = duplicateLayer(config, i)
        commit(next)
        setActive(newIndex)
    }
    const onDelete = (i: number): void => {
        if (!config || config.layers.length <= 1) return
        commit(removeLayer(config, i))
        if (active >= config.layers.length - 1)
            setActive(Math.max(0, config.layers.length - 2))
        else if (active > i) setActive(active - 1)
    }

    return (
        <div className="space-y-0.5">
            {layers.map((l, i) => {
                const on = i === active
                const accent = layerAccent(i)
                return (
                    <div
                        key={i}
                        onClick={() => setActive(i)}
                        className="group relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors"
                        style={{
                            background: on
                                ? `color-mix(in oklch, ${accent} 16%, var(--sidebar))`
                                : 'transparent',
                            border: `1px solid ${on ? `color-mix(in oklch, ${accent} 42%, transparent)` : 'transparent'}`,
                        }}
                    >
                        <span
                            className="size-2.5 shrink-0 rounded-[3px]"
                            style={{
                                background: accent,
                                boxShadow: on ? `0 0 8px ${accent}` : 'none',
                            }}
                        />
                        {editing === i ? (
                            <input
                                autoFocus
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={commitRename}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitRename()
                                    if (e.key === 'Escape') setEditing(null)
                                }}
                                className="min-w-0 flex-1 rounded-md border border-primary bg-background px-1.5 py-0.5 text-[13px] font-semibold text-foreground outline-none"
                            />
                        ) : (
                            <span
                                onDoubleClick={() => startRename(i)}
                                className={`min-w-0 flex-1 truncate text-[13.5px] ${on ? 'font-bold' : 'font-medium'}`}
                            >
                                {l.name}
                            </span>
                        )}
                        <span className="font-mono text-[11px] text-muted-foreground">
                            L{i}
                        </span>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    aria-label="Layer actions"
                                    onClick={(e) => e.stopPropagation()}
                                    className="grid size-[22px] place-items-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
                                >
                                    <MoreVertical size={15} />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <DropdownMenuItem
                                    onSelect={() => startRename(i)}
                                >
                                    <Pencil size={15} /> Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onSelect={() => onDuplicate(i)}
                                >
                                    <Copy size={15} /> Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    variant="destructive"
                                    disabled={layers.length <= 1}
                                    onSelect={() => onDelete(i)}
                                >
                                    <Trash2 size={15} /> Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )
            })}
            <button
                type="button"
                onClick={onAdd}
                className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-2.5 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
                <Plus size={15} /> Add layer
            </button>
        </div>
    )
}
