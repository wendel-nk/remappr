import { KeyLabel } from './KeyLabel'

export interface HoldTapLabels {
    tap: React.ReactNode
    hold: React.ReactNode
    tooltip?: string
}

interface HoldTapKeyLabelProps {
    holdTap: HoldTapLabels
    maxChildFontSize: number
    maxHoldFontSize: number
    hoverZoom?: boolean
}

export function HoldTapKeyLabel({
    holdTap,
    maxChildFontSize,
    maxHoldFontSize,
    hoverZoom,
}: HoldTapKeyLabelProps): JSX.Element {
    return (
        <>
            <div className="key-tap-section flex items-center justify-center w-full flex-1 overflow-hidden border-b border-border/40 pt-2">
                <KeyLabel
                    maxFontSize={maxChildFontSize}
                    minFontSize={4}
                    hoverZoom={hoverZoom}
                    className="font-keycap"
                >
                    {holdTap.tap}
                </KeyLabel>
            </div>
            <div className="key-hold-section flex items-center justify-center w-full h-[40%] overflow-hidden bg-muted/40 text-muted-foreground">
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
