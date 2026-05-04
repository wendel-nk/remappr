import {Children, CSSProperties, PropsWithChildren} from 'react'
import {KeyLabel} from './KeyLabel'
import {HoldTapKeyLabel, type HoldTapLabels} from './HoldTapKeyLabel'
import useUserSettingsStore from '@/stores/userSettingsStore'
import useConnectionStore from '@/stores/connectionStore'

export type {HoldTapLabels}

interface KeyButtonProps {
    selected?: boolean
    pressed?: boolean
    width: number
    height: number
    oneU: number
    hoverZoom?: boolean
    header?: string
    actionLabel?: string
    holdTap?: HoldTapLabels
    onClick?: () => void
}

interface KeyDimension {
    width: number
    height: number
}

function makeSize (
    {width, height}: KeyDimension,
    oneU: number,
): CSSProperties {
    width *= oneU
    height *= oneU

    return {
        '--key-center-width': 'calc(' + width + 'px - 2px)',
        width: 'calc(' + width + 'px - 2px)',
        '--key-center-height': 'calc(' + height + 'px - 2px)',
        height: 'calc(' + height + 'px - 2px)',
    }
}

export const KeyButton = ( {
    selected = false,
    pressed = false,
    header,
    actionLabel,
    oneU,
    hoverZoom = true,
    holdTap,
    ...props
}: PropsWithChildren<KeyButtonProps> ): JSX.Element => {
    const size = makeSize( props, oneU )
    const maxChildFontSize = Math.max( 10, oneU / 2.5 )
    const maxHoldFontSize = Math.max( 8, oneU / 4 )
    const firmware = useConnectionStore( ( s ) => s.service?.deviceInfo.firmware )
    const keyDisplayModeMap = useUserSettingsStore( ( s ) => s.keyDisplayMode )
    const keyDisplayMode =
        keyDisplayModeMap[firmware ?? '_default'] ??
        keyDisplayModeMap['_default'] ??
        'displayName'

    const effectiveHeader =
        keyDisplayMode === 'binding' && actionLabel ? actionLabel : header
    const isBindingMode = keyDisplayMode === 'binding' && !!actionLabel
    const headerFontPx = Math.max( 6, Math.round( oneU / 8 ) )
    const tooltipParts = [
        header,
        actionLabel ? `(${actionLabel})` : '',
        holdTap?.tooltip,
    ].filter( Boolean )
    const tooltip = tooltipParts.join( ' — ' )

    const children = Children.map(
        props.children,
        ( c ): React.ReactElement => (
            <KeyLabel
                maxFontSize={maxChildFontSize}
                minFontSize={4}
                className="font-keycap flex-1"
                hoverZoom={hoverZoom}
            >
                {c}
            </KeyLabel>
        ),
    )

    return (
        <div
            className="group inline-flex box-border b-0 flex-col justify-items-center justify-content-center items-center transition-all duration-0 hover:scale-150 border border-transparent hover:border-border rounded-none"
            data-zoomer={hoverZoom}
            style={size as React.CSSProperties}
            {...props}
        >
            <button
                type="button"
                aria-pressed={selected}
                data-zoomer={hoverZoom}
                title={tooltip || undefined}
                className={`relative rounded-none transition-all duration-100 box-border bg-secondary text-secondary-foreground border border-border aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:border-primary grow
                 flex-col flex items-center ${holdTap ? 'justify-stretch' : 'justify-center'} w-full h-full overflow-hidden ${
                    pressed ? 'bg-green-600 text-white shadow-lg scale-95' : ''
                }`}
            >
                {effectiveHeader && (
                    <span
                        className={`absolute top-1 left-1 leading-none opacity-70 pointer-events-none whitespace-nowrap ${
                            isBindingMode ? 'font-mono' : ''
                        }`}
                        style={{fontSize: `${headerFontPx}px`}}
                    >
                        {effectiveHeader}
                    </span>
                )}
                {holdTap ? (
                    <HoldTapKeyLabel
                        holdTap={holdTap}
                        maxChildFontSize={maxChildFontSize}
                        maxHoldFontSize={maxHoldFontSize}
                        hoverZoom={hoverZoom}
                    />
                ) : (
                    children
                )}
            </button>
        </div>
    )
}
