// pattern-check: skip — connected-device binding of the shared RgbControls; cache + debounced facade I/O
//
// Drives a connected keyboard's global RGB effect with the same controls the demo
// uses. The effect is read ONCE on connect into rgbEffectStore (HID is serialized
// and slow), so opening this modal is instant. Edits update the cache optimistically
// (the on-screen glow follows via useStageLighting) and are written to the keyboard
// on a short debounce so dragging a slider doesn't flood HID. Footer Save persists.
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
} from 'react'

import type { RgbApi, RgbEffectState } from '@firmware/service'
import { COLORLESS_EFFECT } from '@firmware/lighting'
import { saveWithToast } from '@/lib/saveWithToast'
import useLightingCatalogStore from '@/stores/lightingCatalogStore'
import useRgbEffectStore from '@/stores/rgbEffectStore'

import { RgbControls, type RgbControlsModel } from './RgbControls'
import { PreviewWriteQueue } from './previewWriteQueue'

interface Props {
    rgb: RgbApi
}

export interface DeviceRgbControlsHandle {
    /** Send and await the latest debounced preview before persistence. */
    flushPreview(): Promise<void>
    /** Drop a not-yet-sent preview and await any write already in flight. */
    cancelPreview(): Promise<void>
}

const WRITE_DEBOUNCE_MS = 90

const toPct = (v: number): number => Math.round((v / 255) * 100)
const fromPct = (p: number): number => Math.round((p / 100) * 255)
const hueToDeg = (h: number): number => Math.round((h / 255) * 360)
const degToHue = (d: number): number => Math.round((d / 360) * 255)

export const DeviceRgbControls = forwardRef<DeviceRgbControlsHandle, Props>(
    function DeviceRgbControls({ rgb }, ref): JSX.Element {
        const state = useRgbEffectStore((s) => s.effect)
        const setCached = useRgbEffectStore((s) => s.setEffect)
        // Prefer the connected board's parsed VIA lighting menu (real effect names),
        // matched by subsystem kind; else the firmware-generic catalog from the facade.
        const boardCatalog = useLightingCatalogStore((s) => s.catalog)
        const cat =
            boardCatalog && boardCatalog.kind === rgb.effectCatalog?.kind
                ? boardCatalog
                : (rgb.effectCatalog ?? boardCatalog ?? null)

        // Debounced device write: glow/UI update instantly via the cache; the keyboard
        // gets at most one write per WRITE_DEBOUNCE_MS while a slider is dragged.
        const previewQueue = useMemo(
            () =>
                new PreviewWriteQueue<RgbEffectState>(
                    (next) => rgb.setEffect!(next),
                    WRITE_DEBOUNCE_MS,
                    (error) =>
                        void saveWithToast(
                            () => Promise.reject(error),
                            null,
                            'RGB preview write failed',
                        ),
                ),
            [rgb],
        )
        const flush = useCallback(() => previewQueue.flush(), [previewQueue])
        const cancelPreview = useCallback(
            () => previewQueue.cancel(),
            [previewQueue],
        )

        useImperativeHandle(
            ref,
            () => ({ flushPreview: flush, cancelPreview }),
            [cancelPreview, flush],
        )

        // Seed the cache if connect didn't manage to read the effect (HID was busy).
        useEffect(() => {
            if (state || !rgb.getEffect) return
            let cancelled = false
            ;(async () => {
                const r = await saveWithToast(
                    () => rgb.getEffect!(),
                    null,
                    'Read RGB effect failed',
                )
                if (!cancelled && r) setCached(r)
            })()
            return (): void => {
                cancelled = true
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [rgb])

        // Flush any pending write when the modal closes (component unmounts).
        useEffect(
            () => (): void => {
                void saveWithToast(flush, null, 'RGB preview write failed')
            },
            [flush],
        )

        if (!cat || !rgb.getEffect || !rgb.setEffect) {
            return (
                <div className="text-xs text-muted-foreground">
                    Backlight effects not exposed by this firmware build.
                </div>
            )
        }

        const apply = (patch: Partial<RgbEffectState>): void => {
            if (!state) return
            const next = { ...state, ...patch }
            setCached(next) // instant UI + glow
            previewQueue.schedule(next)
        }

        const reload = async (): Promise<void> => {
            await previewQueue.cancel()
            const r = await saveWithToast(
                () => rgb.getEffect!(),
                null,
                'Read RGB effect failed',
            )
            if (r) setCached(r)
        }

        const name = state ? (cat.effects[state.mode] ?? '') : ''
        const usesColor = cat.hasColor && !COLORLESS_EFFECT.test(name)

        const model: RgbControlsModel = {
            effects: cat.effects,
            effectIndex: state?.mode ?? 0,
            brightness: state ? toPct(state.brightness) : 0,
            saturation: state ? toPct(state.color.s) : 0,
            speed: state ? toPct(state.speed) : 0,
            hue: state ? hueToDeg(state.color.h) : 0,
            enabled: state?.enabled,
            hasColor: usesColor,
            hasSpeed: cat.hasSpeed,
        }

        return (
            <RgbControls
                model={model}
                onEffect={(i) => apply({ mode: i })}
                onChange={(patch) => {
                    if (!state) return
                    if (patch.brightness !== undefined)
                        apply({ brightness: fromPct(patch.brightness) })
                    if (patch.speed !== undefined)
                        apply({ speed: fromPct(patch.speed) })
                    if (patch.saturation !== undefined)
                        apply({
                            color: {
                                ...state.color,
                                s: fromPct(patch.saturation),
                            },
                        })
                    if (patch.hue !== undefined)
                        apply({
                            color: { ...state.color, h: degToHue(patch.hue) },
                        })
                    if (patch.enabled !== undefined)
                        apply({ enabled: patch.enabled })
                }}
                onReset={() => void reload()}
            />
        )
    },
)
