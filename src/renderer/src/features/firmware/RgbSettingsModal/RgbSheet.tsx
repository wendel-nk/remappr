// pattern-check: skip — RGB bottom-sheet shell; section switch + reuse of existing control panels
//
// Board-visible RGB lighting sheet, docked below the keyboard (like the keycode/
// behaviour picker) and toggled by the Header Lightbulb via rgbSheetStore. Because
// the board stays visible, the on-screen glow previews edits live. Sections:
//   • Backlight        — global effect (DeviceRgbControls / SimulationPanel)
//   • Per-key RGB      — select key(s) on the board, then colour them
//   • Mix RGB          — 2-zone timeline (placeholder, not yet implemented)
//   • Underglow        — capability-driven ZMK Studio lighting
//   • Indicator Light  — caps/layer indicators (placeholder)
//   • Advanced         — raw Mix-region + Indicator byte editors (power users)
import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, Save, X } from 'lucide-react'
import { toast } from 'sonner'

import useConnectionStore from '@/stores/connectionStore'
import useRgbSheetStore from '@/stores/rgbSheetStore'
import useRgbEffectStore from '@/stores/rgbEffectStore'
import { Button } from '@/ui/button'
import { Card, CardContent } from '@/ui/card'

import type { PaintApi } from '@/features/keymap/keyboard/stage/usePerKeyPaint'
import {
    DeviceRgbControls,
    type DeviceRgbControlsHandle,
} from './DeviceRgbControls'
import { SimulationPanel } from './SimulationPanel'
import { IndicatorPanel } from './IndicatorPanel'
import { ComingSoon } from './ComingSoonSection'
import { PerKeyColorEditor } from './PerKeyColorEditor'
import { AdvancedPanels } from './AdvancedRgbPanels'
import { RgbSheetNav } from './RgbSheetNav'
import { sectionsForRgb } from './rgbSheetSections'

interface Props {
    paint: PaintApi
    selectedKeyPosition: number | undefined
    multiSelection: Set<number>
    onClose: () => void
}

export function RgbSheet({
    paint,
    selectedKeyPosition,
    multiSelection,
    onClose,
}: Props): JSX.Element {
    const rgb = useConnectionStore((s) => s.service?.rgb)
    const section = useRgbSheetStore((s) => s.section)
    const setSection = useRgbSheetStore((s) => s.setSection)
    const setCachedEffect = useRgbEffectStore((s) => s.setEffect)
    const controlsRef = useRef<DeviceRgbControlsHandle>(null)
    const [pendingState, setPendingState] = useState<{
        source: NonNullable<typeof rgb>
        value: boolean
    } | null>(null)
    const [busy, setBusy] = useState(false)

    const sections = useMemo(() => sectionsForRgb(rgb), [rgb])
    const activeSection = sections.some((s) => s.id === section)
        ? section
        : (sections[0]?.id ?? 'backlight')
    const tracksPending = !!rgb?.hasPendingChanges
    const pending =
        pendingState && pendingState.source === rgb
            ? pendingState.value
            : (rgb?.hasPendingChanges?.() ?? true)

    useEffect(() => {
        if (!rgb) return
        const report = (value: boolean): void =>
            setPendingState({ source: rgb, value })
        const off = rgb.onPendingChangesChanged?.(report)
        void rgb
            .refreshPendingChanges?.()
            .then(report)
            .catch((error) =>
                console.warn('RGB pending-state read failed', error),
            )
        return off
    }, [rgb])

    const save = async (): Promise<void> => {
        if (!rgb || busy) return
        setBusy(true)
        try {
            await controlsRef.current?.flushPreview()
            await rgb.save()
            setPendingState({ source: rgb, value: false })
            toast.success('RGB settings saved to keyboard')
        } catch (error) {
            const detail =
                error instanceof Error ? error.message : String(error)
            toast.error(`Save failed: ${detail}`)
            console.error(error)
        } finally {
            setBusy(false)
        }
    }

    const discard = async (): Promise<void> => {
        if (!rgb?.discard || busy) return
        setBusy(true)
        try {
            await controlsRef.current?.cancelPreview()
            const restored = await rgb.discard()
            if (restored) setCachedEffect(restored)
            else if (rgb.getEffect) setCachedEffect(await rgb.getEffect())
            setPendingState({ source: rgb, value: false })
            toast.success('RGB preview discarded')
        } catch (error) {
            const detail =
                error instanceof Error ? error.message : String(error)
            toast.error(`Discard failed: ${detail}`)
            console.error(error)
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="p-2 w-full">
            <Card className="relative">
                <CardContent className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <RgbSheetNav
                            activeSection={activeSection}
                            setSection={setSection}
                            sections={sections}
                        />
                        <div className="ml-auto flex items-center gap-1.5">
                            {rgb && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex items-center gap-1.5"
                                    disabled={
                                        busy || (tracksPending && !pending)
                                    }
                                    onClick={(): void => void save()}
                                >
                                    <Save className="size-3.5" />
                                    Save
                                </Button>
                            )}
                            {rgb?.discard && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="flex items-center gap-1.5"
                                    disabled={
                                        busy || (tracksPending && !pending)
                                    }
                                    onClick={(): void => void discard()}
                                >
                                    <RotateCcw className="size-3.5" />
                                    Discard
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

                    {/* Native overflow (not radix ScrollArea): a max-height-only
                        radix Root has no definite height for its h-full viewport,
                        so tall content was clipped with no scrollbar. */}
                    <div className="max-h-[40vh] overflow-y-auto pr-2">
                        {activeSection === 'backlight' &&
                            (rgb ? (
                                <DeviceRgbControls
                                    ref={controlsRef}
                                    rgb={rgb}
                                />
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
                        {activeSection === 'underglow' &&
                            (rgb ? (
                                <DeviceRgbControls
                                    ref={controlsRef}
                                    rgb={rgb}
                                />
                            ) : (
                                <ComingSoon
                                    title="Underglow"
                                    note="RGB underglow is not exposed by this firmware build."
                                />
                            ))}
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
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
