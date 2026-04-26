import { Children, CSSProperties, PropsWithChildren } from 'react'
import { KeyLabel } from './KeyLabel'
import { HoldTapKeyLabel, type HoldTapLabels } from './HoldTapKeyLabel'

export type { HoldTapLabels }

interface KeyButtonProps {
    selected?: boolean
    pressed?: boolean
    width: number
    height: number
    oneU: number
    hoverZoom?: boolean
    header?: string
    holdTap?: HoldTapLabels
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
        '--zmk-key-center-width': 'calc(' + width + 'px - 2px)',
        width: 'calc(' + width + 'px - 2px)',
        '--zmk-key-center-height': 'calc(' + height + 'px - 2px)',
        height: 'calc(' + height + 'px - 2px)',
    }
}

export const KeyButton = ({
    selected = false,
    pressed = false,
    header,
    oneU,
    hoverZoom = true,
    holdTap,
    ...props
}: PropsWithChildren<KeyButtonProps>): JSX.Element => {
    const size = makeSize(props, oneU)
    const maxChildFontSize = Math.max(10, oneU / 2.5)
    const maxHoldFontSize = Math.max(8, oneU / 4)
    const maxHeaderFontSize = Math.max(6, oneU / 6)

    const children = Children.map(
        props.children,
        (c): React.ReactElement => (
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
            className="group inline-flex box-border b-0 flex-col justify-items-center justify-content-center items-center transition-all duration-0 hover:scale-150 border border-transparent hover:border-border rounded-md"
            data-zoomer={hoverZoom}
            style={size as React.CSSProperties}
            {...props}
        >
            <button
                type="button"
                aria-pressed={selected}
                data-zoomer={hoverZoom}
                title={holdTap?.tooltip}
                className={`rounded${
                    oneU > 20 ? '-md' : ''
                } transition-all duration-100 box-border bg-secondary text-secondary-foreground border border-border aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:border-primary grow
                 flex-col flex items-center ${holdTap ? 'justify-stretch' : 'justify-evenly'} w-full h-full overflow-hidden ${
                     pressed ? 'bg-green-600 text-white shadow-lg scale-95' : ''
                 }`}
            >
                {holdTap ? (
                    <HoldTapKeyLabel
                        holdTap={holdTap}
                        header={header}
                        maxChildFontSize={maxChildFontSize}
                        maxHoldFontSize={maxHoldFontSize}
                        maxHeaderFontSize={maxHeaderFontSize}
                        hoverZoom={hoverZoom}
                    />
                ) : (
                    <>
                        {header && (
                            <KeyLabel
                                maxFontSize={maxHeaderFontSize}
                                minFontSize={4}
                                hoverZoom={hoverZoom}
                                className={'flex-none'}
                            >
                                {header}
                            </KeyLabel>
                        )}
                        {children}
                    </>
                )}
            </button>
        </div>
    )
}
