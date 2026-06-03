// Pattern check: no GoF pattern (-) — rejected — a presentational controlled form
// rendering the hardware-draft fields; UI plumbing bound to hardwareForm.ts, no
// abstraction or polymorphism.
//
// Edits a `HardwareDraft` (board/shield + kscan wiring) for the Keyboard Builder.
// Fully controlled: holds no state, lifts every change to `onChange`. The parent
// (KeyboardBuilder) owns the draft and lowers it to canonical hardware on save.
import { Label } from '@/ui/label'
import { Input } from '@/ui/input'
import { Separator } from '@/ui/separator'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'
import { cn } from '@/lib/cn'
import {
    parseGpioLines,
    type HardwareDraft,
    type KscanKind,
} from './hardwareForm'

interface HardwareFormProps {
    value: HardwareDraft
    onChange: (next: HardwareDraft) => void
    /** Board key count, used only for live "N of M" GPIO hints. */
    keyCount: number
}

const textareaClass = cn(
    'border-input dark:bg-input/30 min-h-24 w-full rounded-md border bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none transition-[color,box-shadow]',
    'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
)

const GPIO_PLACEHOLDER = '&gpio0 4 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)'

export function HardwareForm({
    value,
    onChange,
    keyCount,
}: HardwareFormProps): JSX.Element {
    const set = <K extends keyof HardwareDraft>(
        key: K,
        v: HardwareDraft[K],
    ): void => onChange({ ...value, [key]: v })

    const rowCount = parseGpioLines(value.rowGpios).length
    const colCount = parseGpioLines(value.colGpios).length
    const inputCount = parseGpioLines(value.inputGpios).length

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="hw-board">Board</Label>
                    <Input
                        id="hw-board"
                        placeholder="nice_nano_v2"
                        value={value.board}
                        onChange={(e) => set('board', e.target.value)}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="hw-shield">Shield (optional)</Label>
                    <Input
                        id="hw-shield"
                        placeholder="corne_left"
                        value={value.shield}
                        onChange={(e) => set('shield', e.target.value)}
                    />
                </div>
            </div>

            <Separator />

            <div className="space-y-1.5">
                <Label>Key-scan wiring</Label>
                <Select
                    value={value.kscanKind}
                    onValueChange={(v) => set('kscanKind', v as KscanKind)}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">
                            None (keep board overlay&apos;s kscan)
                        </SelectItem>
                        <SelectItem value="matrix">
                            Matrix (row × column GPIOs)
                        </SelectItem>
                        <SelectItem value="direct">
                            Direct (one GPIO per key)
                        </SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                    One devicetree GPIO spec per line, e.g.{' '}
                    <span className="font-mono">{GPIO_PLACEHOLDER}</span>.
                </p>
            </div>

            {value.kscanKind === 'matrix' && (
                <div className="space-y-5">
                    <div className="space-y-1.5">
                        <Label>Diode direction</Label>
                        <Select
                            value={value.diodeDirection}
                            onValueChange={(v) =>
                                set(
                                    'diodeDirection',
                                    v as HardwareDraft['diodeDirection'],
                                )
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="col2row">col2row</SelectItem>
                                <SelectItem value="row2col">row2col</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="hw-rows">
                                Row GPIOs{' '}
                                <span className="text-muted-foreground">
                                    ({rowCount})
                                </span>
                            </Label>
                            <textarea
                                id="hw-rows"
                                className={textareaClass}
                                placeholder={GPIO_PLACEHOLDER}
                                value={value.rowGpios}
                                onChange={(e) =>
                                    set('rowGpios', e.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="hw-cols">
                                Column GPIOs{' '}
                                <span className="text-muted-foreground">
                                    ({colCount})
                                </span>
                            </Label>
                            <textarea
                                id="hw-cols"
                                className={textareaClass}
                                placeholder={GPIO_PLACEHOLDER}
                                value={value.colGpios}
                                onChange={(e) =>
                                    set('colGpios', e.target.value)
                                }
                            />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {rowCount} × {colCount} = {rowCount * colCount} matrix
                        positions for {keyCount} keys.
                    </p>
                </div>
            )}

            {value.kscanKind === 'direct' && (
                <div className="space-y-1.5">
                    <Label htmlFor="hw-inputs">
                        Input GPIOs{' '}
                        <span className="text-muted-foreground">
                            ({inputCount} of {keyCount})
                        </span>
                    </Label>
                    <textarea
                        id="hw-inputs"
                        className={textareaClass}
                        placeholder={GPIO_PLACEHOLDER}
                        value={value.inputGpios}
                        onChange={(e) => set('inputGpios', e.target.value)}
                    />
                </div>
            )}

            {value.kscanKind !== 'none' && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="hw-dp">Debounce press (ms)</Label>
                        <Input
                            id="hw-dp"
                            inputMode="numeric"
                            placeholder="5"
                            value={value.debouncePressMs}
                            onChange={(e) =>
                                set('debouncePressMs', e.target.value)
                            }
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="hw-dr">Debounce release (ms)</Label>
                        <Input
                            id="hw-dr"
                            inputMode="numeric"
                            placeholder="5"
                            value={value.debounceReleaseMs}
                            onChange={(e) =>
                                set('debounceReleaseMs', e.target.value)
                            }
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
