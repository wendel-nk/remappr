// Pattern check: no GoF pattern (-) — rejected — presentational matrix descriptor
// + pin-mapping form; config/commit/matrix helpers passed in, no abstraction.
import { Wand2 } from 'lucide-react'
import type { ConfigKeyboard, ConfigKeymap } from '@firmware/config'
import { MiniLabel } from '../MiniLabel'
import { TextField } from '../builderFormControls'
import {
    colPins,
    rowPins,
    setColPinsText,
    setRowPinsText,
} from '../builderPins'
import { setMatrixMeta } from '../builderInspectorOps'

export function MatrixSection({
    config,
    kb,
    dims,
    commit,
    onAutoMatrix,
}: {
    config: ConfigKeymap
    kb: ConfigKeyboard
    dims: { rows: number; cols: number; perHalf: boolean }
    commit: (c: ConfigKeymap) => void
    onAutoMatrix: () => void
}): JSX.Element {
    return (
        <div>
            <MiniLabel>Matrix</MiniLabel>
            <div className="flex items-center gap-2.5 rounded-[9px] border border-border bg-background px-3 py-2.5">
                <div className="flex-1">
                    <div className="font-mono text-[13px] font-bold">
                        {dims.rows} × {dims.cols}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                        rows × columns{dims.perHalf ? ' per half' : ''} ·{' '}
                        {kb.keys.length} keys
                        {kb.keys.some((k) => k.matrix) ? ' · wired' : ''}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onAutoMatrix}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-[12px] font-semibold text-foreground hover:border-primary"
                >
                    <Wand2 size={13} /> Auto
                </button>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                Auto assigns each key&apos;s row/column from its position.
                Per-key wiring lands in the inspector.
            </p>
            {/* Diode direction + scan mode (board matrix descriptor) */}
            <div className="mt-2.5 grid grid-cols-2 gap-2">
                <div>
                    <div className="mb-1 text-[11px] text-muted-foreground">
                        Diode direction
                    </div>
                    <select
                        value={kb.matrix?.diodeDirection ?? 'col2row'}
                        onChange={(e) =>
                            commit(
                                setMatrixMeta(config, {
                                    diodeDirection: e.target.value as
                                        | 'row2col'
                                        | 'col2row',
                                }),
                            )
                        }
                        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 font-mono text-[12px] font-semibold text-foreground outline-none focus:border-primary"
                    >
                        <option value="col2row">COL2ROW</option>
                        <option value="row2col">ROW2COL</option>
                    </select>
                </div>
                <div>
                    <div className="mb-1 text-[11px] text-muted-foreground">
                        Scan mode
                    </div>
                    <select
                        value={kb.matrix?.mode ?? 'matrix'}
                        onChange={(e) =>
                            commit(
                                setMatrixMeta(config, {
                                    mode: e.target.value as 'matrix' | 'direct',
                                }),
                            )
                        }
                        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 font-mono text-[12px] font-semibold text-foreground outline-none focus:border-primary"
                    >
                        <option value="matrix">Matrix (row × col)</option>
                        <option value="direct">Direct (1 GPIO/key)</option>
                    </select>
                </div>
            </div>
            {/* Pin mapping (friendly labels → kscan) */}
            <div className="mt-2.5 text-[11px] text-muted-foreground">
                Pin mapping
            </div>
            <div className="mt-1 grid grid-cols-2 gap-2">
                <TextField
                    mono
                    value={rowPins(config).join(' ')}
                    onCommit={(v) => commit(setRowPinsText(config, v))}
                    placeholder="row pins"
                />
                <TextField
                    mono
                    value={colPins(config).join(' ')}
                    onCommit={(v) => commit(setColPinsText(config, v))}
                    placeholder="col pins"
                />
            </div>
        </div>
    )
}
