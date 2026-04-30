// pattern-check: skip — adding manual check button + IPC plumbing, no abstraction
import { useState } from 'react'
import { Settings as SettingsIcon, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { DarkModeToggle } from '@/components/DarkModeToggle'
import { ThemePicker } from '@/components/ThemePicker'
import { KeyDisplayModePicker } from '@/components/KeyDisplayModePicker'
import { DownloadLatestButton } from '@/components/DownloadLatestButton'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import useUserSettingsStore from '@/stores/userSettingsStore'
import { APP_VERSION } from '@/lib/constants'
import { IpcChannels } from '../../../../shared/ipc-types'
import type { UpdateCheckResultPayload } from '../../../../shared/ipc-types'

interface ElectronWindow {
    api?: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
    }
}

interface SettingsProps {
    opened?: boolean
    onClose?: () => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Settings(_props: SettingsProps): JSX.Element {
    const [checking, setChecking] = useState(false)
    const api = (window as unknown as ElectronWindow).api
    const isElectron = Boolean(api)
    const autoLoadLayout = useUserSettingsStore((s) => s.autoLoadLayout)
    const setAutoLoadLayout = useUserSettingsStore((s) => s.setAutoLoadLayout)

    const handleCheckUpdates = async (): Promise<void> => {
        if (!api) return
        setChecking(true)
        try {
            const result = (await api.invoke(
                IpcChannels.UPDATES_CHECK,
            )) as UpdateCheckResultPayload
            if (result.status === 'newer' && result.version) {
                toast.success(`Update available: v${result.version}`, {
                    description:
                        'A toast with download options should appear shortly.',
                })
            } else if (result.status === 'current') {
                toast.success('You are on the latest version', {
                    description: `Remappr v${APP_VERSION} is up to date.`,
                })
            } else {
                toast.error('Could not check for updates', {
                    description: result.error ?? 'Unknown error',
                })
            }
        } finally {
            setChecking(false)
        }
    }

    return (
        <Modal
            customModalBoxClass="w-11/14 max-w-4xl"
            type="icon"
            icon={<SettingsIcon />}
            variant="ghost"
        >
            <div className="space-y-6">
                {/* Theme Settings */}
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

                {/* Keymap Display */}
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

                {/* Layout */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Layout</h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <Label htmlFor="auto-load-layout">
                                Auto-load layout from registry
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Search the-via and Keychron repos on connect.
                                When off, use the Load layout JSON button to
                                upload manually.
                            </p>
                        </div>
                        <input
                            id="auto-load-layout"
                            type="checkbox"
                            className="h-5 w-5 cursor-pointer"
                            checked={autoLoadLayout}
                            onChange={(e) =>
                                setAutoLoadLayout(e.target.checked)
                            }
                        />
                    </div>
                </div>

                {/* About */}
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold">About</h3>
                    <p className="text-sm">
                        Remappr{' '}
                        <span className="font-mono">v{APP_VERSION}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <DownloadLatestButton />
                        {isElectron && (
                            <Button
                                variant="ghost"
                                onClick={handleCheckUpdates}
                                disabled={checking}
                            >
                                <RefreshCw
                                    className={`mr-2 h-4 w-4 ${
                                        checking ? 'animate-spin' : ''
                                    }`}
                                />
                                {checking ? 'Checking…' : 'Check for updates'}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    )
}
