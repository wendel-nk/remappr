import { DarkModeToggle } from '@/components/DarkModeToggle'
import { ThemePicker } from '@/components/ThemePicker'
import { KeyDisplayModePicker } from '@/components/KeyDisplayModePicker'
import { Label } from '@/ui/label'

export function GeneralSection(): JSX.Element {
    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Appearance</h3>
                <div className="flex items-center justify-between">
                    <div>
                        <Label htmlFor="theme-picker">Theme</Label>
                        <p className="text-sm text-muted-foreground">
                            Choose a color theme
                        </p>
                    </div>
                    <ThemePicker />
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <Label htmlFor="theme-toggle">Dark Mode</Label>
                        <p className="text-sm text-muted-foreground">
                            Toggle between light and dark themes
                        </p>
                    </div>
                    <DarkModeToggle />
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Keymap Display</h3>
                <div className="flex items-center justify-between">
                    <div>
                        <Label>Key Header</Label>
                        <p className="text-sm text-muted-foreground">
                            Show action name (Key Press) or binding code
                            (&amp;kp)
                        </p>
                    </div>
                    <KeyDisplayModePicker />
                </div>
            </div>
        </div>
    )
}
