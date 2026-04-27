import { KeyLabel } from './KeyLabel'

export interface HoldTapLabels {
    tap: React.ReactNode
    hold: React.ReactNode
    tooltip?: string
}

interface HoldTapKeyLabelProps {
    holdTap: HoldTapLabels
    header?: string
    maxChildFontSize: number
    maxHoldFontSize: number
    maxHeaderFontSize: number
    hoverZoom?: boolean
}

export function HoldTapKeyLabel({
    holdTap,
    header,
    maxChildFontSize,
    maxHoldFontSize,
    maxHeaderFontSize,
    hoverZoom,
}: HoldTapKeyLabelProps): JSX.Element {
    return (
        <>
            {header && (
                <div className="key-header-section flex items-center justify-center w-full h-[20%] overflow-hidden">
                    <KeyLabel
                        maxFontSize={maxHeaderFontSize}
                        minFontSize={4}
                        hoverZoom={hoverZoom}
                    >
                        {header}
                    </KeyLabel>
                </div>
            )}
            <div className="key-tap-section flex items-center justify-center w-full flex-1 overflow-hidden border-b border-border/40">
                <KeyLabel
                    maxFontSize={maxChildFontSize}
                    minFontSize={4}
                    hoverZoom={hoverZoom}
                    className="font-keycap"
                >
                    {holdTap.tap}
                </KeyLabel>
            </div>
            <div className="key-hold-section flex items-center justify-center w-full h-[35%] overflow-hidden bg-muted/40 text-muted-foreground">
                <KeyLabel
                    maxFontSize={maxHoldFontSize}
                    minFontSize={4}
                    hoverZoom={hoverZoom}
                    className="font-keycap"
                >
                    {holdTap.hold}
                </KeyLabel>
            </div>
        </>
    )
}
