// pattern-check: skip — RGB bottom-sheet shell; section switch + reuse of existing control panels
//
// Board-visible RGB lighting sheet, docked below the keyboard (like the keycode/
// behaviour picker) and toggled by the Header Lightbulb via rgbSheetStore. Because
// the board stays visible, the on-screen glow previews edits live. Sections:
//   • Backlight        — global effect (DeviceRgbControls / SimulationPanel)
//   • Per-key RGB      — select key(s) on the board, then colour them
//   • Mix RGB          — 2-zone timeline (placeholder, not yet implemented)
//   • Underglow        — RGB underglow / ZMK (placeholder)
//   • Indicator Light  — caps/layer indicators (placeholder)
//   • Advanced         — raw Mix-region + Indicator byte editors (power users)
import { useCallback, useEffect, useRef } from 'react'
import {
    CircleDot,
    Grid3x3,
    Layers,
    Save,
    SlidersHorizontal,
    Sparkles,
    Sun,
    X,
} from 'lucide-react'

import type { HsvColor } from '@firmware/service'
import useConnectionStore from '@/stores/connectionStore'
import useRgbSheetStore, { type RgbSheetSection } from '@/stores/rgbSheetStore'
import usePerKeyPaintStore from '@/stores/perKeyPaintStore'
import { saveWithToast } from '@/lib/saveWithToast'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/button'
import { Card, CardContent } from '@/ui/card'
import { ScrollArea } from '@/ui/scroll-area'

import type { PaintApi } from '@/features/keymap/keyboard/stage/usePerKeyPaint'
import { DeviceRgbControls } from './DeviceRgbControls'
import { SimulationPanel } from './SimulationPanel'
import { MixedPanel } from './MixedPanel'
import { IndicatorPanel } from './IndicatorPanel'
import { ColorPicker } from './ColorPicker'

interface Props {
    paint: PaintApi
    selectedKeyPosition: number | undefined
    multiSelection: Set<number>
    onClose: () => void
}

const COMMIT_DEBOUNCE_MS = 90

const SECTIONS: { id: RgbSheetSection; label: string; icon: typeof Sun }[] = [
    { id: 'backlight', label: 'Backlight', icon: Sun },
    { id: 'perkey', label: 'Per-key RGB', icon: Grid3x3 },
    { id: 'mix', label: 'Mix RGB', icon: Layers },
    { id: 'underglow', label: 'Underglow', icon: Sparkles },
    { id: 'indicator', label: 'Indicator Light', icon: CircleDot },
    { id: 'advanced', label: 'Advanced', icon: SlidersHorizontal },
]

export function RgbSheet({
    paint,
    selectedKeyPosition,
    multiSelection,
    onClose,
}: Props): JSX.Element {
    const rgb = useConnectionStore((s) => s.service?.rgb)
    const section = useRgbSheetStore((s) => s.section)
    const setSection = useRgbSheetStore((s) => s.setSection)

    const activeSection = SECTIONS.some((s) => s.id === section)
        ? section
        : 'backlight'

    return (
        <div className="p-2 w-full">
            <Card className="relative">
                <CardContent className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <nav className="flex flex-wrap gap-1">
                            {SECTIONS.map(({ id, label, icon: Icon }) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={(): void => setSection(id)}
                                    aria-current={
                                        activeSection === id
                                            ? 'page'
                                            : undefined
                                    }
                                    className={cn(
                                        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                                        activeSection === id
                                            ? 'bg-accent text-accent-foreground'
                                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                                    )}
                                >
                                    <Icon className="size-4 shrink-0" />
                                    {label}
                                </button>
                            ))}
                        </nav>
                        <div className="ml-auto flex items-center gap-1.5">
                            {rgb && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex items-center gap-1.5"
                                    onClick={(): void => {
                                        void saveWithToast(
                                            () => rgb.save(),
                                            'RGB settings saved to keyboard',
                                            'Save failed',
                                        )
                                    }}
                                >
                                    <Save className="size-3.5" />
                                    Save
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={onClose}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <ScrollArea className="max-h-[40vh] pr-2">
                        {activeSection === 'backlight' &&
                            (rgb ? (
                                <DeviceRgbControls rgb={rgb} />
                            ) : (
                                <SimulationPanel />
                            ))}
                        {activeSection === 'perkey' && (
                            <PerKeyColorEditor
                                paint={paint}
                                selectedKeyPosition={selectedKeyPosition}
                                multiSelection={multiSelection}
                            />
                        )}
                        {activeSection === 'mix' && (
                            <ComingSoon
                                title="Mix RGB"
                                note="Split the keyboard into two zones, each with its own looping effect timeline. Coming soon."
                            />
                        )}
                        {activeSection === 'underglow' && (
                            <ComingSoon
                                title="Underglow"
                                note="RGB underglow control (ZMK / QMK rgblight). Coming soon."
                            />
                        )}
                        {activeSection === 'indicator' &&
                            (rgb ? (
                                <IndicatorPanel rgb={rgb} />
                            ) : (
                                <ComingSoon
                                    title="Indicator Light"
                                    note="Connect a keyboard to edit its OS-lock indicators."
                                />
                            ))}
                        {activeSection === 'advanced' && <AdvancedPanels />}
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    )
}

/** Placeholder body for a not-yet-implemented section. */
function ComingSoon({
    title,
    note,
}: {
    title: string
    note: string
}): JSX.Element {
    return (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
            <span className="text-sm font-semibold">{title}</span>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                {note}
            </p>
        </div>
    )
}

/** Select key(s) on the board, then colour them. Activates the device per-key
 *  mode (+ glow seeding) while mounted; edits coalesce into one debounced write. */
function PerKeyColorEditor({
    paint,
    selectedKeyPosition,
    multiSelection,
}: {
    paint: PaintApi
    selectedKeyPosition: number | undefined
    multiSelection: Set<number>
}): JSX.Element {
    const colors = usePerKeyPaintStore((s) => s.colors)
    // usePerKeyPaint returns a fresh object each render but its functions are
    // memoized — depend on those (not `paint`) so the effects below don't thrash
    // active/commit on every colour-drag frame.
    const {
        available,
        brush,
        setActive,
        commitPaint,
        setBrush,
        onKeyPaint,
        fillAll,
        clearAll,
    } = paint

    // Activate per-key mode (seeds glow + switches the board to per-key) while the
    // section is shown; deactivate on leave so other glow sources resume.
    useEffect(() => {
        setActive(true)
        return (): void => setActive(false)
    }, [setActive])

    // Debounced device flush: dragging the picker updates glow every frame but
    // writes to the keyboard at most once per COMMIT_DEBOUNCE_MS (reuses the
    // coalescing queue in usePerKeyPaint — onKeyPaint queues, commitPaint flushes).
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const scheduleCommit = useCallback((): void => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => commitPaint(), COMMIT_DEBOUNCE_MS)
    }, [commitPaint])
    useEffect(
        () => (): void => {
            if (timer.current) clearTimeout(timer.current)
            commitPaint() // flush any pending edit on unmount
        },
        [commitPaint],
    )

    const targets =
        multiSelection.size > 0
            ? [...multiSelection]
            : selectedKeyPosition != null
              ? [selectedKeyPosition]
              : []
    const primary = targets[0]
    const current: HsvColor =
        primary != null ? (colors[primary] ?? brush) : brush

    if (!available) {
        return (
            <div className="text-xs text-muted-foreground">
                Per-key RGB not exposed by this firmware build.
            </div>
        )
    }

    const apply = (next: HsvColor): void => {
        setBrush(next)
        for (const idx of targets) onKeyPaint(idx)
        scheduleCommit()
    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                Select one or more keys on the keyboard, then pick a colour.
                Cmd/Ctrl-click adds keys; Shift-click selects a range.
            </p>
            {targets.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No key selected — click a key on the board to colour it.
                </div>
            ) : (
                <div className="rounded-xl border p-3">
                    <div className="mb-2 text-xs font-semibold">
                        {targets.length === 1
                            ? `Key ${primary}`
                            : `${targets.length} keys selected`}
                    </div>
                    <ColorPicker value={current} onChange={apply} />
                </div>
            )}
            <div className="flex gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={(): void => {
                        fillAll()
                    }}
                >
                    Fill all
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={(): void => {
                        clearAll()
                    }}
                >
                    Clear
                </Button>
            </div>
        </div>
    )
}

// pattern-check: skip — deletes the buggy raw indicators editor + dead state, no abstraction
/** Raw Mix-region byte editors (advanced; connected boards only). Indicators
 *  now have a friendly editor in the Indicator Light tab. */
function AdvancedPanels(): JSX.Element {
    const rgb = useConnectionStore((s) => s.service?.rgb)

    if (!rgb) {
        return (
            <div className="text-xs text-muted-foreground">
                Advanced raw-byte controls need a connected keyboard.
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <MixedPanel rgb={rgb} />
        </div>
    )
}
