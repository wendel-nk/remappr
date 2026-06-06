// pattern-check: skip — RGB settings modal shell; sidebar-nav orchestration only
//
// One RGB-lighting modal. When an RGB-capable keyboard is connected it shows the
// device control panels (Backlight / Per-key / Mix / Indicators) and the on-screen
// keyboard glow mirrors those settings. With no RGB device (demo mode, non-RGB
// boards) it shows the manual simulation controls instead. Either way the glow is a
// *simulation* — the firmware does not report per-key colours, so the on-screen
// colours reflect the configured effect/hue/brightness, not the literal LED state.
import { useEffect, useState } from 'react'
import { CircleDot, Grid3x3, Layers, Lightbulb, Save, Sun } from 'lucide-react'

import useConnectionStore from '@/stores/connectionStore'
import { saveWithToast } from '@/lib/saveWithToast'
import { cn } from '@/lib/cn'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { ScrollArea } from '@/ui/scroll-area'

import { BacklightPanel } from './BacklightPanel'
import { BytesEditor } from './BytesEditor'
import { MixedPanel } from './MixedPanel'
import { PerKeyPanel } from './PerKeyPanel'
import { SimulationPanel } from './SimulationPanel'

interface Props {
    opened: boolean
    onClose: () => void
}

type RgbSection = 'backlight' | 'perkey' | 'mixed' | 'indicators'

const SECTIONS: { id: RgbSection; label: string; icon: typeof Sun }[] = [
    { id: 'backlight', label: 'Backlight', icon: Sun },
    { id: 'perkey', label: 'Per-key RGB', icon: Grid3x3 },
    { id: 'mixed', label: 'Mix RGB', icon: Layers },
    { id: 'indicators', label: 'Indicator Light', icon: CircleDot },
]

export function RgbSettingsModal({ opened, onClose }: Props): JSX.Element {
    const rgb = useConnectionStore((s) => s.service?.rgb)

    const [section, setSection] = useState<RgbSection>('backlight')
    const [ledCount, setLedCount] = useState<number | null>(null)
    const [indicatorsRaw, setIndicatorsRaw] = useState<Uint8Array>(
        new Uint8Array(),
    )
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!opened || !rgb) return
        let cancelled = false
        ;(async () => {
            setLoading(true)
            const r = await saveWithToast(
                async () => {
                    const count = await rgb.getLedCount()
                    const ind = await rgb.getIndicators()
                    return { count, raw: ind.raw }
                },
                null,
                'Read RGB failed',
            )
            if (!cancelled && r) {
                setLedCount(r.count)
                setIndicatorsRaw(r.raw)
            }
            if (!cancelled) setLoading(false)
        })()
        return (): void => {
            cancelled = true
        }
    }, [opened, rgb])

    // No RGB-capable device: the modal becomes the on-screen simulation editor.
    if (!rgb) {
        return (
            <Modal
                opened={opened}
                onClose={onClose}
                title="RGB Lighting"
                subtitle="Simulated on-screen — preview effects, colour & speed"
                headerIcon={<Lightbulb />}
                customModalBoxClass="w-11/14 max-w-lg"
                showFooter={false}
            >
                <SimulationPanel />
            </Modal>
        )
    }

    const save = (): Promise<void | undefined> =>
        saveWithToast(
            () => rgb.save(),
            'RGB settings saved to keyboard',
            'Save failed',
        )

    const writeIndicators = (): Promise<void | undefined> =>
        saveWithToast(
            () => rgb.setIndicators({ raw: indicatorsRaw }),
            'Indicators written',
            'Indicators write failed',
        )

    const reloadIndicators = async (): Promise<void> => {
        const r = await saveWithToast(
            () => rgb.getIndicators(),
            null,
            'Indicators read failed',
        )
        if (r) setIndicatorsRaw(r.raw)
    }

    const ledPreview = Array.from({ length: Math.min(ledCount ?? 0, 36) })

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="RGB Settings"
            subtitle={
                ledCount === null
                    ? 'Backlight effects'
                    : `Backlight effects · ${ledCount} LEDs`
            }
            headerIcon={<Lightbulb />}
            customModalBoxClass="w-11/14 max-w-3xl"
            showFooter={false}
            footer={
                <>
                    <span className="mr-auto text-xs text-muted-foreground">
                        Writes apply to the connected keyboard
                    </span>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                    <Button
                        onClick={save}
                        disabled={loading}
                        className="flex items-center gap-1.5"
                    >
                        <Save className="size-3.5" />
                        Save to keyboard
                    </Button>
                </>
            }
        >
            <div className="flex min-h-[26rem] gap-4 text-sm">
                {/* sidebar nav */}
                <aside className="w-44 shrink-0 border-r pr-2">
                    <nav className="flex flex-col gap-0.5">
                        {SECTIONS.map(({ id, label, icon: Icon }) => {
                            // pattern-check: skip — presentational nav button map
                            const active = section === id
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={(): void => setSection(id)}
                                    aria-current={active ? 'page' : undefined}
                                    className={cn(
                                        'flex items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] font-medium transition-colors',
                                        active
                                            ? 'bg-accent text-accent-foreground'
                                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                                    )}
                                >
                                    <Icon className="size-4 shrink-0" />
                                    {label}
                                </button>
                            )
                        })}
                    </nav>

                    {/* LED layout preview */}
                    {ledPreview.length > 0 && (
                        <div className="mt-4 px-1">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                LED layout · {ledCount}
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {ledPreview.map((_, i) => (
                                    <span
                                        key={i}
                                        className="size-2.5 rounded-[3px] bg-primary/60 shadow-[0_0_6px] shadow-primary/40"
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* on-screen glow note */}
                    <p className="mt-4 px-1 text-[10.5px] leading-relaxed text-muted-foreground">
                        The on-screen keyboard glow simulates these settings.
                        Per-key colours aren&apos;t reported by the keyboard.
                    </p>
                </aside>

                {/* active section */}
                <ScrollArea className="max-h-[60vh] flex-1 pr-2">
                    {section === 'backlight' && <BacklightPanel rgb={rgb} />}
                    {section === 'perkey' && (
                        <PerKeyPanel rgb={rgb} ledCount={ledCount ?? 0} />
                    )}
                    {section === 'mixed' && <MixedPanel rgb={rgb} />}
                    {section === 'indicators' && (
                        <BytesEditor
                            label="Indicators"
                            bytes={indicatorsRaw}
                            onChange={setIndicatorsRaw}
                            onReload={reloadIndicators}
                            onWrite={writeIndicators}
                        />
                    )}
                </ScrollArea>
            </div>
        </Modal>
    )
}
