// pattern-check: skip — Keychron RGB settings modal shell; tabs orchestration only
import { useEffect, useState } from 'react'

import useConnectionStore from '@/stores/connectionStore'
import { saveWithToast } from '@/lib/saveWithToast'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/tabs'

import { BytesEditor } from './BytesEditor'
import { MixedPanel } from './MixedPanel'
import { PerKeyPanel } from './PerKeyPanel'

interface Props {
    opened: boolean
    onClose: () => void
}

export function RgbSettingsModal({ opened, onClose }: Props): JSX.Element {
    const rgb = useConnectionStore((s) => s.service?.rgb)

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

    if (!rgb) return <></>

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

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="RGB Settings"
            customModalBoxClass="sm:max-w-2xl"
            showFooter={false}
        >
            <div className="flex flex-col gap-3 p-1 text-sm">
                <div className="flex items-center gap-3">
                    <span className="text-xs">
                        <span className="font-semibold">LED count:</span>{' '}
                        {ledCount === null ? '…' : ledCount}
                    </span>
                    <Button
                        size="sm"
                        onClick={save}
                        disabled={loading}
                        className="ml-auto"
                    >
                        Save to keyboard
                    </Button>
                </div>

                <Tabs defaultValue="indicators">
                    <TabsList>
                        <TabsTrigger value="indicators">Indicators</TabsTrigger>
                        <TabsTrigger value="perkey">Per-key</TabsTrigger>
                        <TabsTrigger value="mixed">Mixed</TabsTrigger>
                    </TabsList>
                    <TabsContent value="indicators">
                        <BytesEditor
                            label="Indicators"
                            bytes={indicatorsRaw}
                            onChange={setIndicatorsRaw}
                            onReload={reloadIndicators}
                            onWrite={writeIndicators}
                        />
                    </TabsContent>
                    <TabsContent value="perkey">
                        <PerKeyPanel rgb={rgb} ledCount={ledCount ?? 0} />
                    </TabsContent>
                    <TabsContent value="mixed">
                        <MixedPanel rgb={rgb} />
                    </TabsContent>
                </Tabs>
            </div>
        </Modal>
    )
}
