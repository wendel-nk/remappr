// Pattern check: no GoF pattern (-) — rejected — presentational settings section
// (theme swatch grid + segmented dark-mode + reused pickers) bound to stores; no
// abstraction warranted.
//
// General settings, matched to the design prototype's SettingsDialog "General"
// pane: an Appearance group (theme select + 8-theme swatch grid + segmented
// light/dark/system) and a Keymap Display group (key header + colour-coding).
import { Segmented } from '@/ui/segmented'
import { ThemePicker } from '@/components/ThemePicker'
import { KeyDisplayModePicker } from '@/components/KeyDisplayModePicker'
import { ColorCodingPicker } from '@/components/ColorCodingPicker'
import {
    THEME_NAMES,
    type Theme,
    type ThemeName,
    useTheme,
} from '@/providers/ThemeProvider'

// Swatch colours per theme (bg + primary), ported 1:1 from the prototype so the
// grid previews each theme's palette without mounting it.
const THEME_SWATCH: Record<
    ThemeName,
    { name: string; bg: string; primary: string }
> = {
    default: {
        name: 'Default',
        bg: 'oklch(0.21 0 0)',
        primary: 'oklch(0.55 0.224 286)',
    },
    claude: {
        name: 'Claude',
        bg: 'oklch(0.268 0.004 106)',
        primary: 'oklch(0.672 0.131 39)',
    },
    supabase: {
        name: 'Supabase',
        bg: 'oklch(0.182 0 0)',
        primary: 'oklch(0.55 0.13 157)',
    },
    't3-chat': {
        name: 'T3 Chat',
        bg: 'oklch(0.241 0.02 307)',
        primary: 'oklch(0.53 0.19 4)',
    },
    vercel: {
        name: 'Vercel',
        bg: 'oklch(0.05 0 0)',
        primary: 'oklch(0.96 0 0)',
    },
    twitter: {
        name: 'Twitter',
        bg: 'oklch(0.04 0 0)',
        primary: 'oklch(0.669 0.16 245)',
    },
    bubblegum: {
        name: 'Bubblegum',
        bg: 'oklch(0.25 0.03 234)',
        primary: 'oklch(0.83 0.1 87)',
    },
    catppuccin: {
        name: 'Catppuccin',
        bg: 'oklch(0.215 0.025 284)',
        primary: 'oklch(0.787 0.12 304)',
    },
}

const DARK_MODES: { value: Theme; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
]

/** A label + description on the left, control on the right, bottom border. */
function Row({
    label,
    desc,
    children,
}: {
    label: string
    desc?: string
    children: React.ReactNode
}): JSX.Element {
    return (
        <div className="flex items-center justify-between gap-5 border-b border-border py-3.5">
            <div>
                <div className="text-sm font-semibold">{label}</div>
                {desc && (
                    <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                        {desc}
                    </div>
                )}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    )
}

export function GeneralSection(): JSX.Element {
    const { theme, setTheme, themeName, setThemeName } = useTheme()

    return (
        <div className="space-y-6">
            <div>
                <h3 className="mb-1 text-lg font-bold tracking-tight">
                    Appearance
                </h3>
                <Row
                    label="Theme"
                    desc="Choose a colour theme — light & dark variants included"
                >
                    <ThemePicker />
                </Row>
                {/* swatch grid */}
                <div className="grid grid-cols-4 gap-2 border-b border-border py-3.5">
                    {THEME_NAMES.map((name) => {
                        const s = THEME_SWATCH[name]
                        const active = themeName === name
                        return (
                            <button
                                key={name}
                                type="button"
                                onClick={() => setThemeName(name)}
                                className="flex items-center gap-2 rounded-[9px] p-1.5 text-left"
                                style={{
                                    background: active
                                        ? 'color-mix(in oklch, var(--primary) 12%, transparent)'
                                        : 'var(--secondary)',
                                    border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                                }}
                            >
                                <span
                                    className="relative size-[22px] shrink-0 rounded-md border border-border"
                                    style={{ background: s.bg }}
                                >
                                    <span
                                        className="absolute inset-1 rounded-[3px]"
                                        style={{ background: s.primary }}
                                    />
                                </span>
                                <span className="truncate text-[11.5px] font-semibold">
                                    {s.name}
                                </span>
                            </button>
                        )
                    })}
                </div>
                <Row label="Dark Mode" desc="Light, dark, or follow the system">
                    <Segmented
                        value={theme}
                        options={DARK_MODES}
                        onChange={setTheme}
                    />
                </Row>
            </div>

            <div>
                <h3 className="mb-1 text-lg font-bold tracking-tight">
                    Keymap Display
                </h3>
                <Row
                    label="Key Header"
                    desc="Show the action name (Key Press) or binding code (&kp)"
                >
                    <KeyDisplayModePicker />
                </Row>
                <Row
                    label="Colour-coding"
                    desc="Tint keys by their function group"
                >
                    <ColorCodingPicker />
                </Row>
            </div>
        </div>
    )
}
