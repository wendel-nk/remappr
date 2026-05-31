// Pattern check: no GoF pattern (-) — rejected — presentational vertical layer-swatch rail
// reading keymap/layer-selection stores; quick layer switch, no abstraction warranted.
import useKeymapStore from '@/stores/keymapStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'

// Layers have no inherent category, so colour them by index on a spread of hues.
const hueForLayer = (i: number): number => (i * 47) % 360

export function LayerColorRail(): JSX.Element | null {
    const keymap = useKeymapStore((s) => s.keymap)
    const { selectedLayerIndex, setSelectedLayerIndex } =
        useLayerSelectionStore()

    if (!keymap || keymap.layers.length === 0) return null

    return (
        <div className="absolute left-2 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2 rounded-full border border-border bg-background/80 p-1.5 shadow-sm backdrop-blur">
            {keymap.layers.map((layer, i) => {
                const active = i === selectedLayerIndex
                const hue = hueForLayer(i)
                return (
                    <Tooltip key={layer.id ?? i}>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                aria-label={`Layer ${layer.name || i}`}
                                aria-pressed={active}
                                onClick={() => setSelectedLayerIndex(i)}
                                className={`size-6 rounded-full transition-transform ${
                                    active
                                        ? 'scale-110'
                                        : 'opacity-60 hover:opacity-100'
                                }`}
                                style={{
                                    background: `oklch(0.62 0.17 ${hue})`,
                                    boxShadow: active
                                        ? `0 0 0 2px var(--background), 0 0 0 4px oklch(0.62 0.17 ${hue})`
                                        : undefined,
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
