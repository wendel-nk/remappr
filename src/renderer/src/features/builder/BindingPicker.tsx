// Pattern check: no GoF pattern (-) — rejected — presentational bottom-dock
// wrapper hosting the shared KeyActionPicker, bridges CanonAction via the codec;
// UI glue, no abstraction.
//
// The Keyboard Builder's binding picker. Rather than ship a second picker, this
// is a thin bottom-dock chrome (grabber + firmware chip + close) around the
// EDITOR's `KeyActionPicker` — the single picker for the whole app. The builder
// feeds it deviceless: firmware-gated `ActionType[]` (builderActionTypes), the
// HID-usage `mockCodec` for the keycode grid, and a `CanonAction ↔ KeyAction`
// bridge (builderKeyActionBridge) so the firmware-neutral config stays the
// source of truth. Picks commit live through onPick.
import { useMemo } from 'react'
import { Bluetooth, Usb, X } from 'lucide-react'
import { mockCodec } from '@firmware/mock/codec'
import type { CanonAction } from '@firmware/config'
import {
    KeyActionPicker,
    type KeyActionDraft,
} from '@/features/actions/KeyActionPicker'
import useConfigStore from '@/stores/configStore'
import useBuilderStore from '@/stores/builderStore'
import type { BindingTarget } from '@/stores/builderStore'
import { builderActionTypes, builderKeycodeCatalog } from './builderActionTypes'
import {
    canonToKeyAction,
    keyActionToCanon,
    type BridgeContext,
} from './builderKeyActionBridge'
import { bindingLabel } from './builderInspectorOps'

const FW_NAME: Record<string, string> = {
    qmk: 'QMK',
    via: 'VIA',
    vial: 'Vial',
    zmk: 'ZMK',
}

export function BindingPicker({
    target,
    onPick,
    onClose,
}: {
    target: BindingTarget
    onPick: (action: CanonAction) => void
    onClose: () => void
}): JSX.Element {
    const config = useConfigStore((s) => s.config)
    const activeLayer = useBuilderStore((s) => s.activeLayer)

    const targets = config?.keyboard.firmware
    const layers = useMemo(() => config?.layers ?? [], [config])
    const macros = useMemo(() => config?.macros ?? [], [config])
    const tapDances = useMemo(() => config?.tapDances ?? [], [config])
    const layerName = layers[activeLayer]?.name ?? 'layer'
    const current =
        config?.layers[activeLayer]?.bindings[target.keyIndex] ?? undefined

    const ctx = useMemo<BridgeContext>(
        () => ({
            layerNames: layers.map((l) => l.name),
            macroIds: macros.map((m) => m.id),
            tapDanceIds: tapDances.map((t) => t.id),
        }),
        [layers, macros, tapDances],
    )

    const actionTypes = useMemo(
        () => builderActionTypes(targets, macros, tapDances),
        [targets, macros, tapDances],
    )
    const catalog = useMemo(() => builderKeycodeCatalog(targets), [targets])
    const pickerLayers = useMemo(
        () => layers.map((l, i) => ({ id: i, name: l.name || `layer ${i}` })),
        [layers],
    )

    // Seed from the live binding. Keyed on the serialized action so identity is
    // stable across re-renders (and a commit re-seeds to the same value).
    const currentKey = JSON.stringify(current ?? null)
    const seed = useMemo(
        () => canonToKeyAction(current, ctx),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [currentKey, ctx],
    )

    const fwList = (targets ?? []).filter((id) => id in FW_NAME)
    const fwLabel = fwList.map((id) => FW_NAME[id]).join(' + ') || 'QMK'
    const wireless = fwList.includes('zmk')

    const handleChange = (draft: KeyActionDraft): void => {
        const action = keyActionToCanon(draft.kind, draft.params, ctx)
        if (action) onPick(action)
    }

    return (
        <div
            className="absolute inset-x-0 bottom-0 z-40 flex max-h-[48%] flex-col rounded-t-2xl border-t border-border bg-popover"
            style={{ boxShadow: '0 -20px 50px -20px rgba(0,0,0,.55)' }}
        >
            {/* grabber */}
            <div className="flex justify-center pt-2">
                <div className="h-1 w-10 rounded-full bg-border" />
            </div>

            {/* header */}
            <div className="flex items-center gap-2.5 px-4 py-2.5">
                <span className="text-[13px] font-bold">Binding</span>
                <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground">
                    {layerName} · Key #{target.keyIndex} ·{' '}
                    <span className="font-mono text-foreground">
                        {bindingLabel(current)}
                    </span>
                </span>
                <span
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-bold text-foreground"
                    style={{
                        background:
                            'color-mix(in oklch, var(--primary) 12%, var(--card))',
                        borderColor:
                            'color-mix(in oklch, var(--primary) 35%, transparent)',
                    }}
                    title={`Showing actions for ${fwLabel}`}
                >
                    {wireless ? <Bluetooth size={13} /> : <Usb size={13} />}
                    {fwLabel}
                </span>
                <button
                    type="button"
                    aria-label="Close picker"
                    onClick={onClose}
                    className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                >
                    <X size={16} />
                </button>
            </div>

            {/* the shared editor picker, deviceless */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-1">
                <KeyActionPicker
                    action={seed}
                    actionTypes={actionTypes}
                    layers={pickerLayers}
                    onChange={handleChange}
                    codec={mockCodec}
                    catalog={catalog}
                />
            </div>
        </div>
    )
}
