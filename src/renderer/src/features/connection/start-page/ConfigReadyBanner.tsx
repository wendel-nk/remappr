// Pattern check: no GoF pattern (-) — rejected — presentational banner that
// conditionally mounts the existing Download modal; UI composition, no abstraction.
//
// Bridges the gap between the builder and the export/cloud-build flow: a board
// designed from scratch (or an imported .json) lives in configStore but, with no
// device connected, the app stays on the StartPage — and the Download modal is
// otherwise editor-only (App.tsx routes on a connected `service`, not on config).
// This banner appears whenever a config is loaded and opens the (service-
// independent) Download modal so that built board can be exported / cloud-built.
import { useState } from 'react'
import { FileDown } from 'lucide-react'
import useConfigStore from '@/stores/configStore'
import { Button } from '@/ui/button'
import { Download } from '@/components/modals/Download'

export function ConfigReadyBanner(): JSX.Element | null {
    const config = useConfigStore((s) => s.config)
    const [open, setOpen] = useState(false)
    if (!config) return null

    const layerCount = config.layers.length
    return (
        <div className="mb-8 flex flex-col items-start gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
                <p className="text-sm font-semibold">
                    {config.meta.name} is ready to export
                </p>
                <p className="text-xs text-muted-foreground">
                    {layerCount} layer{layerCount === 1 ? '' : 's'} loaded —
                    download firmware files, push a cloud build, or connect a
                    device below to edit it live.
                </p>
            </div>
            <Button
                onClick={() => setOpen(true)}
                className="flex shrink-0 items-center gap-2"
            >
                <FileDown className="h-4 w-4" />
                Export / build firmware
            </Button>
            <Download opened={open} onClose={() => setOpen(false)} />
        </div>
    )
}
