// Pattern check: Strategy (Tier 1) — applied — per-cap-style chrome (flat/sculpted/mono/
// glass) is chosen at runtime from a style-builder map keyed by capStyle; each builder
// produces its own face/legend layout behind one CapChrome interface.
import { Children, CSSProperties, PropsWithChildren } from 'react'
import { KeyLabel } from './KeyLabel'
import { type HoldTapLabels } from './HoldTapKeyLabel'
import useUserSettingsStore, { type CapStyle } from '@/stores/userSettingsStore'
import useConnectionStore from '@/stores/connectionStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import {
    catStyle,
    CATEGORY_META,
    heatColor,
    type ColorMode,
    type KeyCategory,
} from '@/lib/keymap/keyCategory'

export type { HoldTapLabels }

// pattern-check: skip — additive optional prop on existing KeyButtonProps interface
interface KeyButtonProps {
    selected?: boolean
    /** Part of an active multi-selection (distinct accent ring from `selected`). */
    multiSelected?: boolean
    pressed?: boolean
    width: number
    height: number
    oneU: number
    hoverZoom?: boolean
    header?: string
    actionLabel?: string
    holdTap?: HoldTapLabels
    /** Function category used for colour-coding (alpha/mod/layer/…). */
    category?: KeyCategory
    /** Normalised press intensity 0–1 for the heatmap overlay, or null when off. */
    heat?: number | null
    /** Raw lifetime press count, surfaced in the rich tooltip when the heatmap is on. */
    pressCount?: number | null
    /** Render a rich hover tooltip (tap/action/hold/type/press-count). */
    richTooltip?: boolean
    /** Force a cap style (e.g. settings previews); defaults to the user setting. */
    capStyleOverride?: CapStyle
    /** Force a colour-coding intensity; defaults to the user setting. */
    colorModeOverride?: ColorMode
    onClick?: () => void
}

interface KeyDimension {
    width: number
    height: number
}

function makeSize(
    { width, height }: KeyDimension,
    oneU: number,
): CSSProperties {
    width *= oneU
    height *= oneU

    return {
        '--key-center-width': 'calc(' + width + 'px - 2px)',
        width: 'calc(' + width + 'px - 2px)',
        '--key-center-height': 'calc(' + height + 'px - 2px)',
        height: 'calc(' + height + 'px - 2px)',
    } as CSSProperties
}

// Resolved colours for a cap face, derived from category tint or heatmap value.
interface FaceColors {
    face: string | null
    faceTop: string | null
    edge: string | null
    legend: string
    dot: string | null
    neutral: boolean
    heat: boolean
}

function resolveFaceColors(
    category: KeyCategory,
    colorMode: ColorMode,
    heat: number | null | undefined,
): FaceColors {
    if (heat != null) {
        const hc = heatColor(heat)
        return {
            face: hc.face,
            faceTop: hc.face,
            edge: hc.edge,
            legend: 'oklch(0.98 0 0)',
            dot: null,
            neutral: false,
            heat: true,
        }
    }
    const cs = catStyle(category, colorMode)
    return {
        face: cs.face,
        faceTop: cs.faceTop ?? cs.face,
        edge: cs.edge,
        legend: cs.legend,
        dot: cs.dot,
        neutral: cs.face == null,
        heat: false,
    }
}

interface CapChrome {
    /** Tailwind classes applied to the cap button (neutral theming, borders). */
    className: string
    /** Inline style for the tinted cap surface. */
    style: CSSProperties
    /** Optional sculpted "face" element rendered above the skirt. */
    face?: CSSProperties
    /** Left accent bar (mono style). */
    accentBar?: CSSProperties
    mono: boolean
}

// One builder per cap style — the Strategy set.
const CAP_CHROME: Record<
    'flat' | 'sculpted' | 'mono' | 'glass',
    (F: FaceColors, oneU: number) => CapChrome
> = {
    flat: (F, oneU) => ({
        className: F.neutral ? 'bg-secondary border border-border' : 'border',
        style: {
            borderRadius: Math.max(4, oneU * 0.12),
            ...(F.neutral
                ? {}
                : {
                      background: `linear-gradient(180deg, ${F.faceTop}, ${F.face})`,
                      borderColor: F.heat
                          ? (F.edge ?? 'var(--border)')
                          : 'color-mix(in oklch, var(--border) 70%, transparent)',
                  }),
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)',
        },
        mono: false,
    }),
    sculpted: (F, oneU) => {
        const rad = Math.max(5, oneU * 0.15)
        const skirtTop = F.neutral ? 'oklch(0.305 0 0)' : F.faceTop
        const skirtBot = F.neutral ? 'oklch(0.25 0 0)' : F.face
        return {
            className: '',
            style: {
                borderRadius: rad,
                background: `linear-gradient(180deg, ${skirtTop}, ${skirtBot})`,
                boxShadow: `0 ${oneU * 0.045}px ${oneU * 0.11}px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.05)`,
            },
            face: {
                position: 'absolute',
                top: oneU * 0.07,
                left: oneU * 0.085,
                right: oneU * 0.085,
                bottom: oneU * 0.155,
                borderRadius: rad * 0.7,
                background: F.neutral
                    ? 'linear-gradient(180deg, oklch(0.35 0 0), oklch(0.30 0 0))'
                    : `linear-gradient(180deg, ${F.faceTop}, ${F.face})`,
                boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,.10), 0 1px 2px rgba(0,0,0,.28)',
            },
            mono: false,
        }
    },
    mono: (F, oneU) => ({
        className: 'border border-border overflow-hidden',
        style: {
            borderRadius: Math.max(4, oneU * 0.11),
            background: F.heat ? (F.face ?? undefined) : 'oklch(0.245 0 0)',
        },
        accentBar:
            F.neutral || !F.edge
                ? undefined
                : {
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: Math.max(2, oneU * 0.06),
                      background: F.edge,
                      borderRadius: '3px 0 0 3px',
                  },
        mono: true,
    }),
    glass: (F, oneU) => ({
        className: '',
        style: {
            borderRadius: Math.max(5, oneU * 0.16),
            background: F.neutral
                ? 'color-mix(in oklch, var(--secondary) 55%, transparent)'
                : `linear-gradient(160deg, color-mix(in oklch, ${F.faceTop} 70%, transparent), color-mix(in oklch, ${F.face} 46%, transparent))`,
            border: `1px solid ${
                F.edge
                    ? `color-mix(in oklch, ${F.edge} 60%, transparent)`
                    : 'color-mix(in oklch, var(--border) 60%, transparent)'
            }`,
            backdropFilter: 'blur(6px)',
            boxShadow:
                'inset 0 1px 0 rgba(255,255,255,.18), 0 6px 18px rgba(0,0,0,.32)',
        },
        mono: false,
    }),
}

export const KeyButton = ({
    selected = false,
    multiSelected = false,
    pressed = false,
    header,
    actionLabel,
    oneU,
    hoverZoom = true,
    holdTap,
    category = 'alpha',
    heat = null,
    pressCount = null,
    richTooltip = false,
    capStyleOverride,
    colorModeOverride,
    ...props
}: PropsWithChildren<KeyButtonProps>): JSX.Element => {
    const size = makeSize(props, oneU)
    const maxChildFontSize = Math.max(10, oneU / 2.5)
    const maxHoldFontSize = Math.max(8, oneU / 4)
    const firmware = useConnectionStore((s) => s.service?.deviceInfo.firmware)
    const keyDisplayModeMap = useUserSettingsStore((s) => s.keyDisplayMode)
    const capStyleSetting = useUserSettingsStore((s) => s.capStyle)
    const colorModeSetting = useUserSettingsStore((s) => s.colorMode)
    const capStyle = capStyleOverride ?? capStyleSetting
    const colorMode = colorModeOverride ?? colorModeSetting
    const keyDisplayMode =
        keyDisplayModeMap[firmware ?? '_default'] ??
        keyDisplayModeMap['_default'] ??
        'displayName'

    const effectiveHeader =
        keyDisplayMode === 'binding' && actionLabel ? actionLabel : header
    const isBindingMode = keyDisplayMode === 'binding' && !!actionLabel
    const headerFontPx = Math.max(6, Math.round(oneU / 8))
    const tooltipParts = [
        header,
        actionLabel ? `(${actionLabel})` : '',
        holdTap?.tooltip,
    ].filter(Boolean)
    const tooltip = tooltipParts.join(' — ')

    // Rich-tooltip rows (label → value); only non-empty rows render.
    const tipRows: Array<[string, string]> = []
    if (header) tipRows.push(['Tap', header])
    if (actionLabel) tipRows.push(['Action', actionLabel])
    if (holdTap?.tooltip) tipRows.push(['Hold', holdTap.tooltip])
    const typeLabel = CATEGORY_META[category]?.label
    if (typeLabel) tipRows.push(['Type', typeLabel])
    if (pressCount != null) tipRows.push(['Presses', String(pressCount)])

    const F = resolveFaceColors(category, colorMode, heat)
    const chrome = CAP_CHROME[capStyle](F, oneU)
    const showDot = !!F.dot && !F.heat && !chrome.mono
    const showColor = !F.neutral || F.heat

    // Selected ring + pressed (live) state stack on top of the cap chrome.
    const ringStyle: CSSProperties = selected
        ? {
              boxShadow: `0 0 0 2px var(--background), 0 0 0 4px var(--primary), 0 0 ${oneU * 0.5}px color-mix(in oklch, var(--primary) 55%, transparent)`,
          }
        : multiSelected
          ? {
                boxShadow: `0 0 0 2px var(--background), 0 0 0 3px color-mix(in oklch, var(--primary) 70%, transparent)`,
            }
          : {}
    const pressedStyle: CSSProperties = pressed
        ? {
              background:
                  'linear-gradient(180deg, oklch(0.72 0.18 150), oklch(0.6 0.18 150))',
              boxShadow: `0 0 ${oneU * 0.6}px color-mix(in oklch, oklch(0.7 0.2 150) 70%, transparent)`,
          }
        : {}

    const legendColor = pressed ? '#fff' : F.legend
    const headerColor = pressed
        ? 'rgba(255,255,255,.82)'
        : showColor
          ? `color-mix(in oklch, ${F.legend} 92%, transparent)`
          : 'color-mix(in oklch, var(--foreground) 44%, transparent)'

    const tapNode = holdTap ? holdTap.tap : props.children
    const children = Children.map(
        [tapNode],
        (c): React.ReactElement => (
            <KeyLabel
                maxFontSize={maxChildFontSize}
                minFontSize={4}
                className={`flex-1 ${chrome.mono ? 'font-mono' : 'font-keycap'}`}
                hoverZoom={hoverZoom}
            >
                {c}
            </KeyLabel>
        ),
    )

    const buttonEl = (
        <button
            type="button"
            aria-pressed={selected}
            data-zoomer={hoverZoom}
            title={richTooltip ? undefined : tooltip || undefined}
            style={{ ...chrome.style, ...pressedStyle, ...ringStyle }}
            className={`relative transition-[box-shadow,transform] duration-100 box-border text-secondary-foreground grow flex flex-col items-center justify-center w-full h-full ${chrome.className} ${
                pressed ? 'text-white translate-y-[2px]' : ''
            }`}
        >
            {chrome.face && <div style={chrome.face} aria-hidden />}
            {chrome.accentBar && <div style={chrome.accentBar} aria-hidden />}
            {/* content layer (sits inside the lit face for sculpted) */}
            <div
                className="absolute flex flex-col"
                style={
                    capStyle === 'sculpted'
                        ? {
                              top: oneU * 0.085,
                              left: oneU * 0.11,
                              right: oneU * 0.11,
                              bottom: oneU * 0.17,
                          }
                        : {
                              inset: 0,
                              padding: oneU * 0.1,
                              paddingLeft: chrome.mono
                                  ? oneU * 0.2
                                  : oneU * 0.1,
                          }
                }
            >
                {/* header / category-dot row */}
                <div
                    className="flex items-center justify-between leading-none"
                    style={{ height: oneU * 0.16 }}
                >
                    {effectiveHeader ? (
                        <span
                            className={`leading-none whitespace-nowrap overflow-hidden ${
                                chrome.mono || isBindingMode
                                    ? 'font-mono uppercase'
                                    : ''
                            }`}
                            style={{
                                fontSize: `${headerFontPx}px`,
                                fontWeight: 700,
                                color: headerColor,
                            }}
                        >
                            {effectiveHeader}
                        </span>
                    ) : (
                        <span />
                    )}
                    {showDot && (
                        <span
                            aria-hidden
                            style={{
                                width: Math.max(4, oneU * 0.09),
                                height: Math.max(4, oneU * 0.09),
                                borderRadius: 99,
                                background: F.dot ?? undefined,
                                flexShrink: 0,
                                boxShadow: `0 0 ${oneU * 0.12}px ${F.dot}`,
                            }}
                        />
                    )}
                </div>

                {/* primary legend */}
                <div
                    className="flex-1 flex items-center justify-center min-h-0"
                    style={{ color: legendColor }}
                >
                    {children}
                </div>

                {/* hold legend */}
                {holdTap && (
                    <div
                        className="flex items-end justify-center"
                        style={{ height: oneU * 0.24 }}
                    >
                        <HoldLegend
                            hold={holdTap.hold}
                            color={pressed ? 'rgba(255,255,255,.85)' : F.legend}
                            mono={chrome.mono}
                            maxHoldFontSize={maxHoldFontSize}
                            hoverZoom={hoverZoom}
                        />
                    </div>
                )}
            </div>
        </button>
    )

    return (
        <div
            className="group inline-flex box-border b-0 flex-col justify-items-center justify-content-center items-center transition-all duration-0 hover:scale-150 border border-transparent rounded-none"
            data-zoomer={hoverZoom}
            style={size}
            {...props}
        >
            {richTooltip && tipRows.length > 0 ? (
                <Tooltip>
                    <TooltipTrigger asChild>{buttonEl}</TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6}>
                        <div className="flex flex-col gap-0.5">
                            {tipRows.map(([k, v]) => (
                                <div
                                    key={k}
                                    className="flex items-center gap-2 text-[11px] leading-tight"
                                >
                                    <span className="w-12 shrink-0 opacity-60">
                                        {k}
                                    </span>
                                    <span className="font-medium">{v}</span>
                                </div>
                            ))}
                        </div>
                    </TooltipContent>
                </Tooltip>
            ) : (
                buttonEl
            )}
        </div>
    )
}

function HoldLegend({
    hold,
    color,
    mono,
    maxHoldFontSize,
    hoverZoom,
}: {
    hold: React.ReactNode
    color: string
    mono: boolean
    maxHoldFontSize: number
    hoverZoom?: boolean
}): JSX.Element {
    return (
        <div
            className="flex items-center justify-center w-full leading-none"
            style={{
                color,
                borderTop: `1px solid color-mix(in oklch, ${color} 35%, transparent)`,
                paddingTop: 1,
            }}
        >
            <KeyLabel
                maxFontSize={maxHoldFontSize}
                minFontSize={4}
                className={mono ? 'font-mono' : 'font-keycap'}
                hoverZoom={hoverZoom}
            >
                {hold}
            </KeyLabel>
        </div>
    )
}
