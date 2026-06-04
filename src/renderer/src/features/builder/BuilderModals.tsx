// Pattern check: no GoF pattern (-) — rejected — three presentational "build from"
// modals (preset / grid / KLE import) that each replace the board geometry through
// builderStore.commit; thin UI over replaceGeometry + parsers, no abstraction.
//
// The "Build from" entry points for the left panel, ported from the prototype's
// preset / grid / KLE flows. Each one swaps the whole physical layout via
// geometryEditor.replaceGeometry (keeps layer names, resets bindings) and resets
// the builder's transient selection/view so the new board fits cleanly.
import { useState } from 'react'
import {
    Code2,
    FileX2,
    Grid3x3,
    Keyboard,
    LayoutGrid,
    Plus,
    Split,
    Sparkles,
} from 'lucide-react'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import useBuilderStore from '@/stores/builderStore'
import useConfigStore from '@/stores/configStore'
import type { CanonGeometry } from '@firmware/config'
import { clampDim, gridKeys, replaceGeometry } from './geometryEditor'
import { PRESETS, parseKleGeometry, type BuilderPreset } from './builderPresets'

const PRESET_ICON: Record<BuilderPreset['icon'], JSX.Element> = {
    split: <Split size={18} />,
    grid: <Grid3x3 size={18} />,
    keyboard: <Keyboard size={18} />,
    plus: <Plus size={18} />,
}

/** Shared: apply a fresh geometry to the board + reset the transient view. */
function useApplyGeometry(): (keys: CanonGeometry[]) => void {
    const commit = useBuilderStore((s) => s.commit)
    const clearSelection = useBuilderStore((s) => s.clearSelection)
    const setActiveLayer = useBuilderStore((s) => s.setActiveLayer)
    const resetView = useBuilderStore((s) => s.resetView)
    return (keys) => {
        const config = useConfigStore.getState().config
        if (!config) return
        commit(replaceGeometry(config, keys))
        clearSelection()
        setActiveLayer(0)
        resetView()
    }
}

export function PresetModal({
    open,
    onClose,
}: {
    open: boolean
    onClose: () => void
}): JSX.Element {
    const apply = useApplyGeometry()
    return (
        <Modal
            opened={open}
            onClose={onClose}
            title="Start from a preset"
            subtitle="Replaces the current board layout"
            headerIcon={<LayoutGrid />}
            showFooter={false}
            customModalBoxClass="sm:max-w-[600px]"
        >
            <div className="grid grid-cols-2 gap-2.5 py-1">
                {PRESETS.map((p) => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                            apply(p.build())
                            onClose()
                        }}
                        className="flex items-center gap-3 rounded-xl border border-border bg-background p-3.5 text-left transition-colors hover:border-primary"
                    >
                        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-primary/15 text-primary">
                            {PRESET_ICON[p.icon]}
                        </span>
                        <div className="min-w-0">
                            <div className="truncate text-[13.5px] font-bold">
                                {p.name}
                            </div>
                            <div className="truncate text-[11.5px] text-muted-foreground">
                                {p.sub}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </Modal>
    )
}

export function GridModal({
    open,
    onClose,
}: {
    open: boolean
    onClose: () => void
}): JSX.Element {
    const apply = useApplyGeometry()
    const [rows, setRows] = useState('4')
    const [cols, setCols] = useState('12')
    const r = clampDim(Number(rows))
    const c = clampDim(Number(cols))
    const make = (): void => {
        apply(gridKeys(r, c))
        onClose()
    }
    return (
        <Modal
            opened={open}
            onClose={onClose}
            title="Make a grid"
            subtitle="Ortholinear rows × columns"
            headerIcon={<Grid3x3 />}
            footer={
                <Button onClick={make}>
                    Create {r}×{c} grid
                </Button>
            }
        >
            <div className="grid grid-cols-2 gap-3 py-1">
                <div>
                    <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
                        Rows
                    </div>
                    <Input
                        type="number"
                        min={1}
                        max={24}
                        value={rows}
                        onChange={(e) => setRows(e.target.value)}
                    />
                </div>
                <div>
                    <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
                        Columns
                    </div>
                    <Input
                        type="number"
                        min={1}
                        max={24}
                        value={cols}
                        onChange={(e) => setCols(e.target.value)}
                    />
                </div>
            </div>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                Creates {r * c} keys in a {r}×{c} grid. Resets bindings to
                pass-thru; layer names are kept.
            </p>
        </Modal>
    )
}

export function KleModal({
    open,
    onClose,
}: {
    open: boolean
    onClose: () => void
}): JSX.Element {
    const apply = useApplyGeometry()
    const [text, setText] = useState('')
    const [error, setError] = useState<string | null>(null)
    const doImport = (): void => {
        const res = parseKleGeometry(text)
        if (res.error || !res.keys) {
            setError(res.error ?? 'No keys found.')
            return
        }
        apply(res.keys)
        setText('')
        setError(null)
        onClose()
    }
    return (
        <Modal
            opened={open}
            onClose={() => {
                setError(null)
                onClose()
            }}
            title="Import from KLE"
            subtitle="keyboard-layout-editor.com raw data"
            headerIcon={<LayoutGrid />}
            footer={
                <Button onClick={doImport} disabled={!text.trim()}>
                    Import layout
                </Button>
            }
        >
            <textarea
                value={text}
                onChange={(e) => {
                    setText(e.target.value)
                    setError(null)
                }}
                placeholder={'Paste the "Raw data" from the KLE Download menu…'}
                spellCheck={false}
                className="h-44 w-full resize-none rounded-lg border border-input bg-background p-3 font-mono text-[12px] text-foreground outline-none focus:border-primary"
            />
            {error && (
                <p className="mt-2 text-[12px] font-medium text-destructive">
                    {error}
                </p>
            )}
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
                Imports key positions &amp; sizes only — legends and matrix
                wiring are assigned in the builder.
            </p>
        </Modal>
    )
}

/** Shown each time the builder opens: choose a starting point (preset / KLE /
 *  blank) or dismiss to keep the current board. */
export function StartModal({
    open,
    onClose,
    onPreset,
    onKle,
}: {
    open: boolean
    onClose: () => void
    onPreset: () => void
    onKle: () => void
}): JSX.Element {
    const apply = useApplyGeometry()
    const choices: Array<{
        icon: JSX.Element
        title: string
        sub: string
        onClick: () => void
    }> = [
        {
            icon: <Sparkles size={18} />,
            title: 'Start from a preset',
            sub: 'Corne, ortho, 60%, numpad, macropad…',
            onClick: () => {
                onClose()
                onPreset()
            },
        },
        {
            icon: <Code2 size={18} />,
            title: 'Import from KLE',
            sub: 'Paste keyboard-layout-editor raw data',
            onClick: () => {
                onClose()
                onKle()
            },
        },
        {
            icon: <FileX2 size={18} />,
            title: 'Start blank',
            sub: 'One key — build up from nothing',
            onClick: () => {
                apply([{ x: 0, y: 0, w: 1, h: 1, r: 0 }])
                onClose()
            },
        },
    ]
    return (
        <Modal
            opened={open}
            onClose={onClose}
            title="Design a keyboard"
            subtitle="Pick a starting point — or close to keep the current board"
            headerIcon={<LayoutGrid />}
            showFooter={false}
            customModalBoxClass="sm:max-w-[460px]"
        >
            <div className="flex flex-col gap-2.5 py-1">
                {choices.map((c) => (
                    <button
                        key={c.title}
                        type="button"
                        onClick={c.onClick}
                        className="flex items-center gap-3 rounded-xl border border-border bg-background p-3.5 text-left transition-colors hover:border-primary"
                    >
                        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-primary/15 text-primary">
                            {c.icon}
                        </span>
                        <div className="min-w-0">
                            <div className="truncate text-[13.5px] font-bold">
                                {c.title}
                            </div>
                            <div className="truncate text-[11.5px] text-muted-foreground">
                                {c.sub}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </Modal>
    )
}
