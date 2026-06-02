// Pattern check: Strategy (Tier 1) — applied — per-cap-style chrome (flat/sculpted/mono/
// glass) is chosen at runtime from a style-builder map keyed by capStyle; each builder
// produces its own face/legend layout behind one CapChrome interface.
import { CSSProperties, PropsWithChildren } from 'react'
import { type HoldTapLabels } from './HoldTapKeyLabel'
import useUserSettingsStore, { type CapStyle } from '@/stores/userSettingsStore'
import useConnectionStore from '@/stores/connectionStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import {
    CATEGORY_META,
    catStyle,
    type ColorMode,
    heatColor,
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
    /** The tap glyph text (e.g. "Q", "Vol+") — used only to size the main legend
     * the way the design does (≤2 chars → 0.44U, else 0.30U). Distinct from
     * {@link header}, which is the action-type tag ("Key Press"). */
    tapText?: string
    actionLabel?: string
    holdTap?: HoldTapLabels
    /** Face (cap-fill) category — tints the cap, the dot and the tap legend. */
    category?: KeyCategory
    /**
     * Accent (function) category — colours the header tag + hold legend only.
     * For a home-row mod this is `mod` while {@link category} stays `alpha`, so
     * the cap face is neutral and only the text is accented (design behaviour).
     * Defaults to {@link category} when omitted.
     */
    accentCategory?: KeyCategory
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
    /** Hide the action-type tag (top-left) — used by small, clean previews. */
    showHeaderTag?: boolean
    /** Hide the category dot (top-right) — used by small, clean previews. */
    showCategoryDot?: boolean
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

// pattern-check: skip — verbatim port of the design's face/chrome helpers, pure mappers
// Resolved cap-surface colours, ported 1:1 from the design's KeyCap.computeFaces:
// every style consumes the same concrete set (skirt + face gradients, legend,
// edge, dot). Neutral keys use a fixed dark-grey set so the caps look like real
// (dark) keycaps in any theme — exactly the prototype.
interface FaceColors {
    skirtTop: string
    skirtBot: string
    faceTop: string
    face: string
    legend: string
    edge: string
    dot: string | null
    heat: boolean
}

// Shift the lightness channel of an `oklch(L C H)` string by `delta`, clamped.
function shiftLightness(
    color: string,
    delta: number,
    lo: number,
    hi = 1,
): string {
    return color.replace(
        /oklch\(([\d.]+)/,
        (_m, l: string) =>
            `oklch(${Math.min(hi, Math.max(lo, parseFloat(l) + delta))}`,
    )
}

// Neutral (no-category) caps follow the active theme + light/dark mode via the
// CARD surface pair: `--card`/`--card-foreground` always track the mode (light
// caps in light themes, dark in dark) AND are a guaranteed-contrasting pair in
// every theme — unlike `--secondary`, which some themes (e.g. twitter) use as a
// high-contrast accent that's inverted vs the mode. The face is nudged toward
// the foreground so caps still stand out from the workbench background; faceTop
// goes toward white for the top highlight, skirtBot toward black for depth.
const NEUTRAL_FACES: Omit<FaceColors, 'heat'> = {
    skirtTop: 'color-mix(in oklch, var(--card) 90%, var(--foreground))',
    skirtBot: 'color-mix(in oklch, var(--card) 88%, #000)',
    faceTop: 'color-mix(in oklch, var(--card) 86%, #fff)',
    face: 'color-mix(in oklch, var(--card) 90%, var(--foreground))',
    legend: 'var(--card-foreground)',
    edge: 'var(--border)',
    dot: null,
}

function resolveFaceColors(
    category: KeyCategory,
    colorMode: ColorMode,
    heat: number | null | undefined,
): FaceColors {
    if (heat != null) {
        const hc = heatColor(heat)
        return {
            skirtTop: hc.face,
            skirtBot: shiftLightness(hc.face, -0.06, 0.12),
            faceTop: shiftLightness(hc.face, 0.05, 0, 0.8),
            face: hc.face,
            legend: 'oklch(0.98 0 0)',
            edge: hc.edge,
            dot: null,
            heat: true,
        }
    }
    const cs = catStyle(category, colorMode)
    if (!cs.face) return { ...NEUTRAL_FACES, heat: false }
    return {
        skirtTop: cs.face,
        // color-mix (not shiftLightness) so it still darkens when the face is a
        // CSS-var-based oklch (its lightness isn't a literal to regex-shift).
        skirtBot: `color-mix(in oklch, ${cs.face} 88%, #000)`,
        faceTop: cs.faceTop ?? cs.face,
        face: cs.face,
        legend: cs.legend,
        edge: cs.edge ?? NEUTRAL_FACES.edge,
        dot: cs.dot,
        heat: false,
    }
}

interface CapChrome {
    /** Tailwind classes applied to the cap button. */
    className: string
    /** Inline style for the cap surface. */
    style: CSSProperties
    /** Sculpted "face" element rendered above the skirt. */
    face?: CSSProperties
    /** Left accent bar (mono style). */
    accentBar?: CSSProperties
    mono: boolean
}

// One builder per cap style — ported verbatim from the design's KeyCap.
const CAP_CHROME: Record<
    'flat' | 'sculpted' | 'mono' | 'glass',
    (F: FaceColors, oneU: number) => CapChrome
> = {
    flat: (F, oneU) => ({
        className: '',
        style: {
            borderRadius: Math.max(4, oneU * 0.12),
            background: F.heat
                ? F.face
                : `linear-gradient(180deg, ${F.faceTop}, ${F.face})`,
            border: `1px solid ${F.heat ? F.edge : 'var(--border)'}`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)',
        },
        mono: false,
    }),
    sculpted: (F, oneU) => {
        const rad = Math.max(5, oneU * 0.15)
        return {
            className: '',
            style: {
                borderRadius: rad,
                background: `linear-gradient(180deg, ${F.skirtTop}, ${F.skirtBot})`,
                boxShadow: `0 ${oneU * 0.045}px ${oneU * 0.11}px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.05)`,
            },
            face: {
                position: 'absolute',
                top: oneU * 0.07,
                left: oneU * 0.085,
                right: oneU * 0.085,
                bottom: oneU * 0.155,
                borderRadius: rad * 0.7,
                background: `linear-gradient(180deg, ${F.faceTop}, ${F.face})`,
                boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,.10), 0 1px 2px rgba(0,0,0,.28)',
            },
            mono: false,
        }
    },
    mono: (F, oneU) => ({
        className: '',
        style: {
            borderRadius: Math.max(4, oneU * 0.11),
            background: F.heat ? F.face : 'oklch(0.245 0 0)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
        },
        accentBar:
            F.heat || !F.dot
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
            background: F.heat
                ? F.face
                : `linear-gradient(160deg, color-mix(in oklch, ${F.faceTop} 70%, transparent), color-mix(in oklch, ${F.face} 46%, transparent))`,
            border: `1px solid color-mix(in oklch, ${F.edge} 60%, transparent)`,
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
    tapText,
    actionLabel,
    oneU,
    hoverZoom = true,
    holdTap,
    category = 'alpha',
    accentCategory,
    heat = null,
    pressCount = null,
    richTooltip = false,
    capStyleOverride,
    colorModeOverride,
    showHeaderTag = true,
    showCategoryDot = true,
    ...props
}: PropsWithChildren<KeyButtonProps>): JSX.Element => {
    const size = makeSize(props, oneU)
    // Font sizing ported 1:1 from the design's KeyCap (KeyCap.jsx:70-72): a plain
    // tap legend fills 0.44U, a >2-char tap shrinks to 0.30U, and a tap sharing the
    // cap with a hold legend shrinks to 0.34U (hold 0.175U) so the two never collide.
    const tapLen = tapText ? tapText.length : 0
    const maxChildFontSize = Math.max(
        11,
        oneU * (holdTap ? 0.34 : tapLen > 2 ? 0.3 : 0.44),
    )
    const maxHoldFontSize = Math.max(7, oneU * 0.175)
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

    const headerHidden = keyDisplayMode === 'hidden'
    const effectiveHeader =
        keyDisplayMode === 'binding' && actionLabel ? actionLabel : header
    const isBindingMode = keyDisplayMode === 'binding' && !!actionLabel
    // KeyCap.jsx:71 — header tag is 0.135U (min 6px), not rounded.
    const headerFontPx = Math.max(6, oneU * 0.135)
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
    const showDot = showCategoryDot && !!F.dot && !F.heat

    // Accent colour (header tag + hold legend). Falls back to the face category.
    // Only categories with a hue (mod/layer/punct/…) tint the text; alpha/space
    // and `off` mode leave it neutral — so a home-row mod's header is violet
    // while its cap face stays grey.
    const accentCat = accentCategory ?? category
    const accentColored =
        colorMode !== 'off' && CATEGORY_META[accentCat]?.hue != null
    const accentLegend = accentColored
        ? catStyle(accentCat, colorMode).legend
        : null

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
        : F.heat
          ? 'rgba(255,255,255,.78)'
          : accentLegend
            ? `color-mix(in oklch, ${accentLegend} 92%, transparent)`
            : 'color-mix(in oklch, var(--foreground) 44%, transparent)'

    // Main legend — rendered at a fixed size (KeyCap.jsx:170-177), not auto-fit:
    // the design sizes the tap glyph directly from oneU so it reads identically
    // at every zoom. Colour / weight / letter-spacing / text-shadow come from the
    // wrapper below and are inherited.
    const tapNode = holdTap ? holdTap.tap : props.children
    const mainLegend = (
        <span
            className={`leading-none ${chrome.mono ? 'font-mono' : 'font-keycap'}`}
            style={{ fontSize: maxChildFontSize, lineHeight: 1 }}
        >
            {tapNode}
        </span>
    )

    const buttonEl = (
        <button
            type="button"
            aria-pressed={selected}
            data-zoomer={hoverZoom}
            title={richTooltip ? undefined : tooltip || undefined}
            style={{ ...chrome.style, ...pressedStyle, ...ringStyle }}
            className={`relative transition-[box-shadow] duration-100 box-border text-secondary-foreground grow flex flex-col items-center justify-center w-full h-full ${chrome.className} ${
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
                    {showHeaderTag && !headerHidden && effectiveHeader ? (
                        <span
                            className={`leading-none whitespace-nowrap overflow-hidden ${
                                chrome.mono || isBindingMode
                                    ? 'font-mono uppercase'
                                    : 'font-keycap'
                            }`}
                            style={{
                                fontSize: `${headerFontPx}px`,
                                fontWeight: 700,
                                letterSpacing:
                                    chrome.mono || isBindingMode
                                        ? '.04em'
                                        : '.01em',
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
                                background: F.edge,
                                flexShrink: 0,
                                boxShadow: `0 0 ${oneU * 0.12}px ${F.edge}`,
                            }}
                        />
                    )}
                </div>

                {/* primary legend */}
                <div
                    className="flex-1 flex items-center justify-center min-h-0"
                    style={{
                        color: legendColor,
                        // KeyCap.jsx:172-174 — main legend is 700 (mono 600); a
                        // >2-char tap tightens to -.01em. Set on the wrapper so the
                        // KeyLabel text inherits it.
                        fontWeight: chrome.mono ? 600 : 700,
                        letterSpacing: tapLen > 2 ? '-.01em' : 0,
                        textShadow:
                            capStyle === 'sculpted' && !F.heat
                                ? '0 1px 1px rgba(0,0,0,.35)'
                                : 'none',
                    }}
                >
                    {mainLegend}
                </div>

                {/* hold legend */}
                {holdTap && (
                    <div
                        className="flex items-end justify-center"
                        style={{ height: oneU * 0.24 }}
                    >
                        <HoldLegend
                            hold={holdTap.hold}
                            color={
                                pressed
                                    ? 'rgba(255,255,255,.85)'
                                    : (accentLegend ?? F.legend)
                            }
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
            // No `transition` on transform here: declaring one makes the browser
            // pre-promote every keycap to its own fixed-resolution GPU layer, so a
            // board-level zoom scales each cached bitmap (foggy text) until a hover
            // re-rasterises that one key. The hover scale stays (instant), and with
            // no per-key layers the whole board repaints crisp at any zoom.
            className={`group inline-flex flex-col items-center justify-center ${hoverZoom ? 'hover:scale-[1.06]' : ''}`}
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
}: {
    hold: React.ReactNode
    color: string
    mono: boolean
    maxHoldFontSize: number
    hoverZoom?: boolean
}): JSX.Element {
    // The separator line is the span's own top border, so it spans only the
    // hold word (plus a little side padding) and sits below the tap letter —
    // matching the design. A full-width line would slice through the legend.
    return (
        <span
            className={`max-w-full overflow-hidden text-ellipsis whitespace-nowrap leading-none ${
                mono ? 'font-mono' : 'font-keycap'
            }`}
            style={{
                color,
                borderTop: `1px solid color-mix(in oklch, ${color} 35%, transparent)`,
                paddingTop: 1,
                paddingInline: maxHoldFontSize * 0.34,
                fontSize: maxHoldFontSize,
                fontWeight: 700,
            }}
        >
            {hold}
        </span>
    )
}
