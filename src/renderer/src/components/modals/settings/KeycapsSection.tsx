// Pattern check: no GoF pattern (-) — rejected — settings panel composing existing
// KeyButton previews bound to a store field; presentational only.
import { cn } from '@/lib/cn'
import { Label } from '@/ui/label'
import { KeyButton } from '@/features/keymap/keyboard/KeyButton'
import { ColorCodingPicker } from '@/components/ColorCodingPicker'
import useUserSettingsStore, { type CapStyle } from '@/stores/userSettingsStore'

const STYLES: { value: CapStyle; label: string; blurb: string }[] = [
    {
        value: 'flat',
        label: 'Flat',
        blurb: 'Single tinted tile, crisp border.',
    },
    {
        value: 'sculpted',
        label: 'Sculpted',
        blurb: 'Skirt + lit face with depth.',
    },
    {
        value: 'mono',
        label: 'Mono',
        blurb: 'Dark cap, mono legends, accent bar.',
    },
    { value: 'glass', label: 'Glass', blurb: 'Translucent, glowing edge.' },
]

function CapPreview({ style }: { style: CapStyle }): JSX.Element {
    // Pointer-events disabled so the magnify-on-hover doesn't fire inside the card.
    return (
        <div className="pointer-events-none flex items-end gap-1.5">
            <KeyButton
                width={1}
                height={1}
                oneU={50}
                hoverZoom={false}
                capStyleOverride={style}
                category="alpha"
                header="Key Press"
            >
                A
            </KeyButton>
            <KeyButton
                width={1}
                height={1}
                oneU={50}
                hoverZoom={false}
                capStyleOverride={style}
                category="mod"
                header="Mod-Tap"
                holdTap={{ tap: <span>F</span>, hold: <span>Sft</span> }}
            >
                <span />
            </KeyButton>
            <KeyButton
                width={1}
                height={1}
                oneU={50}
                hoverZoom={false}
                capStyleOverride={style}
                category="layer"
                header="Layer-Tap"
                holdTap={{ tap: <span>Spc</span>, hold: <span>Nav</span> }}
            >
                <span />
            </KeyButton>
            <KeyButton
                width={1}
                height={1}
                oneU={50}
                hoverZoom={false}
                capStyleOverride={style}
                category="nav"
                header="Key Press"
            >
                ←
            </KeyButton>
        </div>
    )
}

export function KeycapsSection(): JSX.Element {
    const capStyle = useUserSettingsStore((s) => s.capStyle)
    const setCapStyle = useUserSettingsStore((s) => s.setCapStyle)

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold">Keycap style</h3>
                    <p className="text-sm text-muted-foreground">
                        How keys are drawn on the board.
                    </p>
                </div>
                <div
                    role="radiogroup"
                    aria-label="Keycap style"
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                    {STYLES.map(({ value, label, blurb }) => {
                        const active = capStyle === value
                        return (
                            // Not a <button>: the live previews render <button> caps,
                            // which can't be nested inside a button.
                            <div
                                key={value}
                                role="radio"
                                tabIndex={0}
                                aria-checked={active}
                                onClick={() => setCapStyle(value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault()
                                        setCapStyle(value)
                                    }
                                }}
                                className={cn(
                                    'flex cursor-pointer flex-col gap-3 rounded-xl border p-3 text-left transition-colors',
                                    active
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                        : 'border-border hover:border-foreground/30 hover:bg-accent/40',
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold">
                                        {label}
                                    </span>
                                    {active && (
                                        <span className="text-xs font-medium text-primary">
                                            Selected
                                        </span>
                                    )}
                                </div>
                                <div className="flex min-h-[64px] items-center justify-center rounded-lg bg-accent/30 p-2">
                                    <CapPreview style={value} />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {blurb}
                                </p>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <Label>Colour coding</Label>
                        <p className="text-sm text-muted-foreground">
                            Tint keys by function (modifiers, layers, nav…).
                        </p>
                    </div>
                    <ColorCodingPicker />
                </div>
            </div>
        </div>
    )
}
