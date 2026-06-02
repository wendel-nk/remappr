// Pattern check: no GoF pattern (-) — rejected — presentational vertical layer-pill rail
// reading keymap/layer-selection stores; quick layer switch, no abstraction warranted.
import useKeymapStore from '@/stores/keymapStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import useLayerPeekStore from '@/stores/layerPeekStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import { layerAccent } from '@/lib/keymap/keyCategory'

// Minimal-chrome layer rail (command workspace), matching the design: bare
// rounded pills — the active layer a tall capsule, the rest small dots, each
// tinted by its layer accent. Caps height + scrolls for many-layer boards.
export function LayerColorRail(): JSX.Element | null {
    const keymap = useKeymapStore((s) => s.keymap)
    const { selectedLayerIndex, setSelectedLayerIndex } =
        useLayerSelectionStore()
    const peekLayerIndex = useLayerPeekStore((s) => s.peekLayerIndex)

    if (!keymap || keymap.layers.length === 0) return null

    // Highlight follows the *displayed* layer (the hover-peeked one if any, else
    // the real selection) so previewing a layer in the sidebar moves the capsule —
    // matching the example's `displayLayer`-driven rail.
    const displayIndex =
        peekLayerIndex != null
            ? Math.min(Math.max(0, peekLayerIndex), keymap.layers.length - 1)
            : selectedLayerIndex

    return (
        <div className="absolute left-4 top-1/2 z-[15] flex max-h-[80%] -translate-y-1/2 flex-col items-center gap-2 overflow-y-auto py-1">
            {keymap.layers.map((layer, i) => {
                const active = i === displayIndex
                const ac = layerAccent(i)
                return (
                    <Tooltip key={layer.id ?? i}>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                aria-label={`Layer ${layer.name || i}`}
                                aria-pressed={active}
                                onClick={() => setSelectedLayerIndex(i)}
                                className="w-2.5 shrink-0 cursor-pointer rounded-full transition-all hover:opacity-100"
                                style={{
                                    height: active ? 30 : 10,
                                    background: ac,
                                    opacity: active ? 1 : 0.5,
                                    boxShadow: active
                                        ? `0 0 10px ${ac}`
                                        : 'none',
                                }}
                            />
                        </TooltipTrigger>
                        <TooltipContent side="right">
                            {layer.name || `Layer ${i}`}
                        </TooltipContent>
                    </Tooltip>
                )
            })}
        </div>
    )
}
