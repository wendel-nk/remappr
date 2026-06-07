import { useCallback, useMemo, useState } from 'react'
import KeyboardView from '@/features/keymap/keyboard/KeyboardView'
import type { KeyPosition } from '@/features/keymap/keyboard/PhysicalLayoutCanvas'
import { usePerKeyPaint } from '@/features/keymap/keyboard/stage/usePerKeyPaint'
import { RgbSheet } from '@/features/firmware/RgbSettingsModal/RgbSheet'
import { BindingEditor } from './BindingEditor'
import useKeymapStore from '@/stores/keymapStore'
import useUserSettingsStore from '@/stores/userSettingsStore'
import useConnectionStore from '@/stores/connectionStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import useRgbSheetStore from '@/stores/rgbSheetStore'

export type EncoderSelection = { slot: number; dir: 'cw' | 'ccw' }

export function KeymapEditor(): JSX.Element {
    const [selectedKeyPosition, setSelectedKeyPositionRaw] = useState<
        number | undefined
    >(undefined)
    const [selectedEncoder, setSelectedEncoderRaw] = useState<
        EncoderSelection | undefined
    >(undefined)
    const [multiSelection, setMultiSelection] = useState<Set<number>>(
        () => new Set(),
    )
    // Picker visibility is decoupled from selection: closing the picker keeps the
    // key selected (a floating info card stays, with an Edit button to reopen),
    // and Escape clears the selection entirely. Mirrors the design's pickerOpen.
    const [pickerOpen, setPickerOpen] = useState(false)
    // Resolved preview of the selected key, surfaced by KeyboardView, so the
    // inspector panel can show the design's selected-key summary card.
    const [selectedKeyInfo, setSelectedKeyInfo] = useState<
        KeyPosition | undefined
    >(undefined)

    const { keymap, setKeymap } = useKeymapStore()

    const setSelectedKeyPosition = useCallback(
        (p: number | undefined): void => {
            setSelectedKeyPositionRaw(p)
            if (p !== undefined) setSelectedEncoderRaw(undefined)
            else setPickerOpen(false)
        },
        [],
    )
    const setSelectedEncoder = useCallback(
        (e: EncoderSelection | undefined): void => {
            setSelectedEncoderRaw(e)
            if (e) setSelectedKeyPositionRaw(undefined)
            else setPickerOpen(false)
        },
        [],
    )

    const workspace = useUserSettingsStore((s) => s.workspace)

    // Per-key RGB paint is lifted here (not KeyboardView) so the RGB bottom sheet
    // and the board share one instance — same LED map, glow colours, and coalesced
    // device writes. keyCount tracks the selected layer's key count.
    const service = useConnectionStore((s) => s.service)
    const selectedLayerIndex = useLayerSelectionStore(
        (s) => s.selectedLayerIndex,
    )
    const keyCountForPaint = useMemo(() => {
        if (!keymap || keymap.layers.length === 0) return 0
        const li = Math.min(
            Math.max(0, selectedLayerIndex),
            keymap.layers.length - 1,
        )
        return keymap.layers[li]?.keys.length ?? 0
    }, [keymap, selectedLayerIndex])
    const paint = usePerKeyPaint(service, keyCountForPaint)

    const rgbSheetOpen = useRgbSheetStore((s) => s.open)
    const rgbSection = useRgbSheetStore((s) => s.section)
    const setRgbSheetOpen = useRgbSheetStore((s) => s.setOpen)
    // Per-key section: board clicks select keys to colour (no keymap picker).
    const lightingPerKey = rgbSheetOpen && rgbSection === 'perkey'

    const keyboard = (
        <KeyboardView
            keymap={keymap}
            selectedKeyPosition={selectedKeyPosition}
            setSelectedKeyPosition={setSelectedKeyPosition}
            selectedEncoder={selectedEncoder}
            setSelectedEncoder={setSelectedEncoder}
            multiSelection={multiSelection}
            setMultiSelection={setMultiSelection}
            workspace={workspace}
            pickerOpen={pickerOpen}
            setPickerOpen={setPickerOpen}
            onSelectedKeyInfoChange={setSelectedKeyInfo}
            paint={paint}
            suppressPicker={lightingPerKey}
        />
    )

    // RGB lighting sheet, docked below the board (replaces the binding picker's
    // bottom slot while open). Toggled by the Header Lightbulb via rgbSheetStore.
    const rgbSheet = rgbSheetOpen ? (
        <RgbSheet
            paint={paint}
            selectedKeyPosition={selectedKeyPosition}
            multiSelection={multiSelection}
            onClose={(): void => setRgbSheetOpen(false)}
        />
    ) : null

    if (workspace === 'inspector') {
        return (
            <div className="flex flex-1 min-h-0">
                <div className="flex min-w-0 flex-1 flex-col">
                    {keyboard}
                    {rgbSheet}
                </div>
                {!rgbSheetOpen && (
                    <BindingEditor
                        variant="panel"
                        keymap={keymap}
                        setKeymap={setKeymap}
                        selectedKeyPosition={selectedKeyPosition}
                        setSelectedKeyPosition={setSelectedKeyPosition}
                        selectedEncoder={selectedEncoder}
                        setSelectedEncoder={setSelectedEncoder}
                        pickerOpen={pickerOpen}
                        setPickerOpen={setPickerOpen}
                        selectedKeyInfo={selectedKeyInfo}
                    />
                )}
            </div>
        )
    }

    return (
        <div className="flex flex-col flex-1">
            {keyboard}
            {rgbSheet}
            {!rgbSheetOpen && workspace !== 'command' && (
                <BindingEditor
                    keymap={keymap}
                    setKeymap={setKeymap}
                    selectedKeyPosition={selectedKeyPosition}
                    setSelectedKeyPosition={setSelectedKeyPosition}
                    selectedEncoder={selectedEncoder}
                    setSelectedEncoder={setSelectedEncoder}
                    pickerOpen={pickerOpen}
                    setPickerOpen={setPickerOpen}
                />
            )}
        </div>
    )
}
