// Pattern check: no GoF pattern (-) — rejected — presentational Vial-security
// form section; setVial writer + selection helpers passed in, no abstraction.
import { Plus, Wand2, X } from 'lucide-react'
import {
    parseUid,
    parseUnlock,
    randomUid,
    uidToHex,
    unlockToText,
} from '@firmware/config'
import type { CanonVial } from '@firmware/config'
import { MiniLabel } from '../MiniLabel'
import { TextField, ToggleRow } from '../builderFormControls'

export function VialSecuritySection({
    vial,
    setVial,
    selKeys,
    addUnlockSelected,
    removeUnlockAt,
}: {
    vial: CanonVial | undefined
    setVial: (p: Partial<CanonVial>) => void
    selKeys: number[]
    addUnlockSelected: () => void
    removeUnlockAt: (idx: number) => void
}): JSX.Element {
    return (
        <div>
            <MiniLabel>Vial security</MiniLabel>
            <div className="mb-1 text-[11px] text-muted-foreground">
                Keyboard UID (8 bytes)
            </div>
            <div className="flex gap-2">
                <div className="flex-1">
                    <TextField
                        mono
                        value={uidToHex(vial?.uid)}
                        onCommit={(v) => setVial({ uid: parseUid(v) })}
                        placeholder="0xFE 0x06 0xBF …"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setVial({ uid: randomUid() })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-[12px] font-semibold text-foreground hover:border-primary"
                >
                    <Wand2 size={13} /> Generate
                </button>
            </div>
            <div className="mt-2.5 mb-1 text-[11px] text-muted-foreground">
                Unlock combo (row,col …)
            </div>
            <TextField
                mono
                value={unlockToText(vial?.unlockKeys)}
                onCommit={(v) => setVial({ unlockKeys: parseUnlock(v) })}
                placeholder="0,0 0,1"
            />
            {/* visual picker — // pattern-check: skip presentational chips + add-selected control */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {(vial?.unlockKeys ?? []).map(([r, c], i) => (
                    <span
                        key={`${r},${c},${i}`}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-1.5 py-0.5 font-mono text-[11px]"
                    >
                        {r},{c}
                        <button
                            type="button"
                            onClick={() => removeUnlockAt(i)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={`Remove unlock key ${r},${c}`}
                        >
                            <X size={11} />
                        </button>
                    </span>
                ))}
                <button
                    type="button"
                    onClick={addUnlockSelected}
                    disabled={selKeys.length === 0}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] font-semibold hover:border-primary disabled:opacity-40"
                >
                    <Plus size={11} /> Add selected ({selKeys.length})
                </button>
            </div>
            <div className="mt-2.5">
                <ToggleRow
                    on={!!vial?.insecure}
                    onToggle={(v) => setVial({ insecure: v || undefined })}
                    label="Insecure (no unlock required)"
                />
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                Vial ties a flashed board to its definition by UID and locks the
                keymap until the unlock keys are held. Emitted to the vial
                keymap&apos;s config.h. Select keys on the board, then “Add
                selected”.
            </p>
        </div>
    )
}
