// Pattern check: no GoF pattern (-) — rejected — presentational lighting controls
// (effect / hue / brightness); setUnder/setBack writers passed in, no abstraction.
import type { CanonLighting } from '@firmware/config'
import { MiniLabel } from '../MiniLabel'
import { HistorySlider, ToggleRow } from '../builderFormControls'
import { HUE_SWATCHES, LIGHTING_EFFECTS } from './constants'

export function LightingSection({
    L,
    setUnder,
    setBack,
}: {
    L: CanonLighting
    setUnder: (
        p: Partial<NonNullable<CanonLighting['underglow']>> | null,
        live?: boolean,
    ) => void
    setBack: (
        p: Partial<NonNullable<CanonLighting['backlight']>> | null,
        live?: boolean,
    ) => void
}): JSX.Element {
    return (
        <div>
            <MiniLabel>Lighting</MiniLabel>
            <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
                Configured for every firmware target — the exporter maps it to
                each platform.
            </p>
            <div className="flex flex-col gap-[7px]">
                <ToggleRow
                    on={!!L.underglow}
                    onToggle={(v) => setUnder(v ? {} : null)}
                    label="RGB underglow"
                />
                {L.underglow && (
                    <div className="flex flex-col gap-2.5 rounded-[9px] border border-border bg-background px-2.5 py-2.5">
                        <div>
                            <div className="mb-1.5 text-[11px] text-muted-foreground">
                                Effect
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {LIGHTING_EFFECTS.map((e) => {
                                    const on =
                                        (L.underglow?.effect ?? 'solid') === e
                                    return (
                                        <button
                                            key={e}
                                            type="button"
                                            onClick={() =>
                                                setUnder({ effect: e })
                                            }
                                            className="rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize text-foreground"
                                            style={{
                                                background: on
                                                    ? 'color-mix(in oklch, var(--primary) 18%, var(--background))'
                                                    : 'var(--secondary)',
                                                border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                                            }}
                                        >
                                            {e}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                        <div>
                            <div className="mb-1.5 text-[11px] text-muted-foreground">
                                Color
                            </div>
                            <div className="flex items-center gap-1.5">
                                {HUE_SWATCHES.map((h, i) => {
                                    const on = L.underglow?.hue === h
                                    return (
                                        <button
                                            key={i}
                                            type="button"
                                            aria-label={
                                                h == null
                                                    ? 'Rainbow'
                                                    : `Hue ${h}`
                                            }
                                            onClick={() => setUnder({ hue: h })}
                                            className="size-[22px] rounded-md p-0"
                                            style={{
                                                border: `2px solid ${on ? 'var(--foreground)' : 'transparent'}`,
                                                background:
                                                    h == null
                                                        ? 'linear-gradient(90deg,#ff4d4d,#ffd24d,#4dff7a,#4dd2ff,#b14dff)'
                                                        : `oklch(0.7 0.2 ${h})`,
                                            }}
                                        />
                                    )
                                })}
                            </div>
                        </div>
                        <div>
                            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                                <span>Brightness</span>
                                <span className="font-mono text-foreground">
                                    {L.underglow?.brightness ?? 80}%
                                </span>
                            </div>
                            <HistorySlider
                                value={L.underglow?.brightness ?? 80}
                                onChange={(v) =>
                                    setUnder({ brightness: v }, true)
                                }
                            />
                        </div>
                    </div>
                )}
                <ToggleRow
                    on={!!L.backlight}
                    onToggle={(v) => setBack(v ? {} : null)}
                    label="Per-key backlight"
                />
                {L.backlight && (
                    <div className="rounded-[9px] border border-border bg-background px-2.5 py-2.5">
                        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                            <span>Backlight brightness</span>
                            <span className="font-mono text-foreground">
                                {L.backlight?.brightness ?? 70}%
                            </span>
                        </div>
                        <HistorySlider
                            value={L.backlight?.brightness ?? 70}
                            onChange={(v) => setBack({ brightness: v }, true)}
                        />
                        <div className="mt-2">
                            <ToggleRow
                                on={!!L.backlight?.breathing}
                                onToggle={(v) =>
                                    setBack({ breathing: v || undefined })
                                }
                                label="Breathing"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
