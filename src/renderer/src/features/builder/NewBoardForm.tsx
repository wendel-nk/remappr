// Pattern check: no GoF pattern (-) — rejected — presentational controlled form
// with a derived grid preview; UI plumbing over geometryEditor.ts, no abstraction.
//
// The "design a board from scratch" entry: name + target + a rows×cols grid. A
// live preview shows the key grid the chosen dimensions produce. Fully controlled
// — the parent owns the draft and turns it into a config (newBoardConfig) on
// create. Free-form per-key drag/resize is a later phase.
import { Label } from '@/ui/label'
import { Input } from '@/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'
import type { Target } from '@firmware/config'
import { clampDim, type NewBoardDraft } from './geometryEditor'

const PREVIEW_CELL_LIMIT = 200

interface NewBoardFormProps {
    value: NewBoardDraft
    onChange: (next: NewBoardDraft) => void
}

export function NewBoardForm({
    value,
    onChange,
}: NewBoardFormProps): JSX.Element {
    const set = <K extends keyof NewBoardDraft>(
        key: K,
        v: NewBoardDraft[K],
    ): void => onChange({ ...value, [key]: v })

    const rows = clampDim(Number(value.rows))
    const cols = clampDim(Number(value.cols))
    const total = rows * cols

    return (
        <div className="space-y-5">
            <div className="space-y-1.5">
                <Label htmlFor="nb-name">Board name</Label>
                <Input
                    id="nb-name"
                    placeholder="My Split 40"
                    value={value.name}
                    onChange={(e) => set('name', e.target.value)}
                />
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="nb-rows">Rows</Label>
                    <Input
                        id="nb-rows"
                        inputMode="numeric"
                        value={value.rows}
                        onChange={(e) => set('rows', e.target.value)}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="nb-cols">Columns</Label>
                    <Input
                        id="nb-cols"
                        inputMode="numeric"
                        value={value.cols}
                        onChange={(e) => set('cols', e.target.value)}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label>Firmware</Label>
                    <Select
                        value={value.target}
                        onValueChange={(v) => set('target', v as Target)}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="zmk">ZMK</SelectItem>
                            <SelectItem value="qmk">QMK</SelectItem>
                            <SelectItem value="keychron">Keychron</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-1.5">
                <Label>
                    Preview{' '}
                    <span className="text-muted-foreground">
                        ({rows} × {cols} = {total} keys)
                    </span>
                </Label>
                <div className="rounded-md border bg-muted/30 p-3">
                    {total <= PREVIEW_CELL_LIMIT ? (
                        <div
                            className="grid gap-0.5"
                            style={{
                                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                            }}
                        >
                            {Array.from({ length: total }, (_, i) => (
                                <div
                                    key={i}
                                    className="aspect-square rounded-sm bg-primary/20"
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-xs text-muted-foreground">
                            {total} keys — too many to preview.
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
