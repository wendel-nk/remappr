// Pattern check: no GoF pattern (-) — rejected — presentational VIA/Vial layout
// option editor; option writers passed in as props, no abstraction.
import { Plus, Trash2, X } from 'lucide-react'
import type { CanonLayoutOption } from '@firmware/config'
import { MiniLabel } from '../MiniLabel'
import { TextField } from '../builderFormControls'

export function LayoutOptionsSection({
    opts,
    selKeys,
    patchOption,
    removeOption,
    addOption,
    tagSelected,
    untagSelected,
}: {
    opts: CanonLayoutOption[]
    selKeys: number[]
    patchOption: (g: number, p: Partial<CanonLayoutOption>) => void
    removeOption: (g: number) => void
    addOption: () => void
    tagSelected: (g: number, choice: number) => void
    untagSelected: () => void
}): JSX.Element {
    return (
        <div>
            <MiniLabel>Layout options</MiniLabel>
            <p className="mb-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                VIA/Vial variants. A blank choices field is an on/off toggle;
                two or more comma-separated choices make a dropdown. Tag keys so
                they appear only in a chosen variant.
            </p>
            {opts.length === 0 && (
                <div className="mb-1.5 text-[11px] text-muted-foreground">
                    No layout options yet.
                </div>
            )}
            {opts.map((o, g) => (
                <div
                    key={g}
                    className="mb-2 rounded-lg border border-border bg-background p-2"
                >
                    <div className="flex items-center gap-2">
                        <div className="flex-1">
                            <TextField
                                value={o.label}
                                onCommit={(v) =>
                                    patchOption(g, {
                                        label: v.trim() || `Option ${g + 1}`,
                                    })
                                }
                                placeholder="Option label"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => removeOption(g)}
                            className="rounded-md border border-border bg-secondary p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive"
                            aria-label={`Remove option ${o.label}`}
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                    <div className="mt-1.5">
                        <TextField
                            value={(o.choices ?? []).join(', ')}
                            onCommit={(v) => {
                                const arr = v
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                patchOption(g, {
                                    choices: arr.length >= 2 ? arr : undefined,
                                })
                            }}
                            placeholder="Choices, comma-separated (blank = toggle)"
                        />
                    </div>
                    {selKeys.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {(o.choices ?? ['(on)']).map((ch, c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => tagSelected(g, c)}
                                    className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] font-semibold hover:border-primary"
                                >
                                    Tag → {ch}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            <div className="flex flex-wrap items-center gap-1.5">
                <button
                    type="button"
                    onClick={addOption}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-[11px] font-semibold hover:border-primary"
                >
                    <Plus size={12} /> Add option
                </button>
                {selKeys.length > 0 && opts.length > 0 && (
                    <button
                        type="button"
                        onClick={untagSelected}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-[11px] font-semibold hover:border-primary"
                    >
                        <X size={12} /> Untag selected ({selKeys.length})
                    </button>
                )}
            </div>
        </div>
    )
}
