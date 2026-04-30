// pattern-check: skip — Keychron wireless settings modal; per-feature reads/writes through service.wireless facade
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import type { KeyboardService, WirelessStatus } from '@firmware'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'

interface Props {
    service: KeyboardService | null
    opened: boolean
    onClose: () => void
}

export function WirelessSettingsModal({
    service,
    opened,
    onClose,
}: Props): JSX.Element {
    const wireless = service?.wireless

    const [lpmEnabled, setLpmEnabled] = useState(false)
    const [lpmTimeout, setLpmTimeout] = useState(0)
    const [nkro, setNkro] = useState<boolean | null>(null)
    const [moduleLabel, setModuleLabel] = useState<string | null>(null)
    const [status, setStatus] = useState<WirelessStatus>({ transport: 'usb' })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!opened || !wireless) return
        let cancelled = false
        ;(async () => {
            setLoading(true)
            try {
                const lpm = await wireless.getLpm()
                if (!cancelled) {
                    setLpmEnabled(lpm.enabled)
                    setLpmTimeout(lpm.timeoutMs)
                }
                if (wireless.getNkro) {
                    const n = await wireless.getNkro()
                    if (!cancelled) setNkro(n)
                }
                if (wireless.getModuleInfo) {
                    try {
                        const info = await wireless.getModuleInfo()
                        if (!cancelled) setModuleLabel(info.label)
                    } catch {
                        /* optional */
                    }
                }
                const s = await wireless.getStatus()
                if (!cancelled) setStatus(s)
            } catch (e) {
                toast.error(
                    `Failed to read wireless settings: ${
                        e instanceof Error ? e.message : String(e)
                    }`,
                )
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        const off = wireless.onStatusChanged((s) => setStatus(s))
        return (): void => {
            cancelled = true
            off()
        }
    }, [opened, wireless])

    if (!wireless) return <></>

    const saveLpm = async (): Promise<void> => {
        try {
            await wireless.setLpm({
                enabled: lpmEnabled,
                timeoutMs: lpmTimeout,
            })
            toast.success('Wireless LPM updated')
        } catch (e) {
            toast.error(
                `Failed to update LPM: ${
                    e instanceof Error ? e.message : String(e)
                }`,
            )
        }
    }

    const toggleNkro = async (next: boolean): Promise<void> => {
        if (!wireless.setNkro) return
        try {
            await wireless.setNkro(next)
            setNkro(next)
            toast.success(`NKRO ${next ? 'enabled' : 'disabled'}`)
        } catch (e) {
            toast.error(
                `Failed to update NKRO: ${
                    e instanceof Error ? e.message : String(e)
                }`,
            )
        }
    }

    const factoryReset = async (): Promise<void> => {
        if (!wireless.factoryReset) return
        if (
            !window.confirm(
                'Reset all settings to factory defaults? This cannot be undone.',
            )
        ) {
            return
        }
        try {
            await wireless.factoryReset()
            toast.success('Factory reset issued')
        } catch (e) {
            toast.error(
                `Factory reset failed: ${
                    e instanceof Error ? e.message : String(e)
                }`,
            )
        }
    }

    return (
        <Modal opened={opened} onClose={onClose} title="Wireless Settings">
            <div className="flex flex-col gap-4 p-2 text-sm">
                <section className="flex flex-col gap-2">
                    <h3 className="font-semibold">Status</h3>
                    <div className="text-xs text-muted-foreground">
                        Transport: {status.transport}
                        {status.btSlot ? ` · BT slot ${status.btSlot}` : ''}
                        {status.battery
                            ? ` · Battery ${status.battery.level}%${
                                  status.battery.charging ? ' (charging)' : ''
                              }`
                            : ''}
                    </div>
                    {moduleLabel && (
                        <div className="text-xs text-muted-foreground">
                            Wireless module: {moduleLabel}
                        </div>
                    )}
                </section>

                <section className="flex flex-col gap-2">
                    <h3 className="font-semibold">Low-power mode</h3>
                    <div className="flex items-center gap-2">
                        <input
                            id="lpm-enabled"
                            type="checkbox"
                            checked={lpmEnabled}
                            onChange={(e) => setLpmEnabled(e.target.checked)}
                            disabled={loading}
                        />
                        <Label htmlFor="lpm-enabled">Enable LPM</Label>
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="lpm-timeout" className="w-28 text-xs">
                            Timeout (ms)
                        </Label>
                        <Input
                            id="lpm-timeout"
                            type="number"
                            value={lpmTimeout}
                            onChange={(e) =>
                                setLpmTimeout(parseInt(e.target.value, 10) || 0)
                            }
                            className="w-32"
                            disabled={loading}
                        />
                    </div>
                    <Button
                        onClick={saveLpm}
                        disabled={loading}
                        className="w-32"
                    >
                        Save LPM
                    </Button>
                </section>

                {nkro !== null && (
                    <section className="flex flex-col gap-2">
                        <h3 className="font-semibold">N-Key Rollover</h3>
                        <div className="flex items-center gap-2">
                            <input
                                id="nkro"
                                type="checkbox"
                                checked={nkro}
                                onChange={(e) => toggleNkro(e.target.checked)}
                                disabled={loading}
                            />
                            <Label htmlFor="nkro">Enable NKRO</Label>
                        </div>
                    </section>
                )}

                {wireless.factoryReset && (
                    <section className="flex flex-col gap-2">
                        <h3 className="font-semibold text-destructive">
                            Danger zone
                        </h3>
                        <Button
                            variant="destructive"
                            onClick={factoryReset}
                            disabled={loading}
                            className="w-48"
                        >
                            Factory reset
                        </Button>
                    </section>
                )}
            </div>
        </Modal>
    )
}
