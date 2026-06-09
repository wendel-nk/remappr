// pattern-check: skip presentational slider value-map panel, reuses ops + BindingSlotRow, no logic
import useBuilderStore from '@/stores/builderStore'
import type { ConfigKeymap, SliderMap } from '@firmware/config'
import {
    clearSliderBinding,
    setSliderBinding,
    SLIDER_MAPS,
} from './builderInspectorOps'
import { MiniLabel } from './MiniLabel'
import { Field, RangeInput } from './builderFormControls'
import { BindingSlotRow } from './BuilderInspectorBindingSlotRow'

/** Slider element panel: a value-map picker (volume / brightness / wheel /
 *  custom) + an output range; custom maps open the shared binding picker. */
export function SliderPanel({
    config,
    index,
    activeLayer,
    layerName,
    onEditAction,
}: {
    config: ConfigKeymap
    index: number
    activeLayer: number
    layerName: string
    onEditAction: () => void
}): JSX.Element {
    const commit = useBuilderStore((s) => s.commit)
    const slider = config.layers[activeLayer]?.sliderBindings?.[index]
    const set = (patch: Parameters<typeof setSliderBinding>[3]): void =>
        commit(setSliderBinding(config, activeLayer, index, patch))

    return (
        <div className="flex flex-col gap-2">
            <MiniLabel>Slider value-map · {layerName}</MiniLabel>
            <select
                value={slider?.map ?? ''}
                onChange={(e) =>
                    e.target.value === ''
                        ? commit(clearSliderBinding(config, activeLayer, index))
                        : set({ map: e.target.value as SliderMap })
                }
                className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-[13px] font-semibold text-foreground outline-none focus:border-primary"
            >
                <option value="">— No mapping —</option>
                {SLIDER_MAPS.map((m) => (
                    <option key={m.value} value={m.value}>
                        {m.label}
                    </option>
                ))}
            </select>
            {slider && (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <Field label="Min (out)">
                            <RangeInput
                                value={slider.min}
                                onChange={(v) => set({ min: v })}
                            />
                        </Field>
                        <Field label="Max (out)">
                            <RangeInput
                                value={slider.max}
                                onChange={(v) => set({ max: v })}
                            />
                        </Field>
                    </div>
                    {slider.map === 'custom' && (
                        <BindingSlotRow
                            label="Custom action"
                            firmware={config.keyboard.firmware}
                            action={slider.action}
                            onEdit={onEditAction}
                            onClear={() =>
                                set({ action: { type: 'transparent' } })
                            }
                        />
                    )}
                    <p className="rounded-lg border border-border bg-background px-2.5 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
                        Analog input is exported as firmware guidance — the
                        board-side ADC wiring is added in your overlay/keymap.c.
                    </p>
                </>
            )}
        </div>
    )
}
