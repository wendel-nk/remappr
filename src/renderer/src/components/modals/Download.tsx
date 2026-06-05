// Pattern check: no GoF pattern (-) — rejected — modal wrapper; the tabbed
// compile/preview/download body is the shared ExportPanel, this only frames it
// with device status, native fallback, import + flash instructions.
import { useMemo, useRef } from 'react'
import {
    AlertTriangle,
    Copy,
    Download as DownloadIcon,
    FileText,
    Upload,
} from 'lucide-react'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import { toast } from 'sonner'
import useConnectionStore from '@/stores/connectionStore'
import useConfigStore from '@/stores/configStore'
import { downloadExports, exportedContentToString } from '@/lib/blob'
import { type Target, resolveAllowedTargets } from '@firmware/config'
import { createLogger } from '@shared/logger'
import { ExportPanel } from './ExportPanel'

const log = createLogger('Download')

interface DownloadProps {
    opened?: boolean
    onClose?: () => void
}

export function Download({ opened, onClose }: DownloadProps): JSX.Element {
    const { service } = useConnectionStore()
    const { config, source, error, loadFromSource } = useConfigStore()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // The mock is a demo device — treat its 'mock' firmware as "no device pinned"
    // so the user can compile for any target. Real adapters report their family.
    const fw = service?.deviceInfo.firmware ?? null
    const connectedFirmware = fw && fw !== 'mock' ? fw : null

    const allowed = useMemo<Target[]>(() => {
        const byDevice = resolveAllowedTargets(connectedFirmware)
        const pinned = config?.meta.target ?? null
        return pinned && byDevice.includes(pinned) ? [pinned] : byDevice
    }, [connectedFirmware, config?.meta.target])

    // Fallback for a connected device with no remappr config (real adapters
    // don't seed one yet): use the device's own faithful native exporter.
    const handleNativeExport = async (): Promise<void> => {
        if (!service) return
        try {
            downloadExports(await service.exportConfig())
            toast.success('Config downloaded')
        } catch (e) {
            log.error('exportConfig failed', e)
            toast.error('Failed to export config')
        }
    }

    const handleNativeCopy = async (): Promise<void> => {
        if (!service) return
        try {
            const primary = (await service.exportConfig())[0]
            if (!primary) {
                toast.error('Nothing to copy')
                return
            }
            await navigator.clipboard.writeText(
                exportedContentToString(primary.content),
            )
            toast.success(`${primary.filename} copied`)
        } catch (e) {
            log.error('copy failed', e)
            toast.error('Failed to copy to clipboard')
        }
    }

    const handleImportSource = async (
        e: React.ChangeEvent<HTMLInputElement>,
    ): Promise<void> => {
        const file = e.target.files?.[0]
        e.target.value = '' // allow re-importing the same file
        if (!file) return
        const text = await file.text()
        if (loadFromSource(text)) toast.success(`Imported ${file.name}`)
        else toast.error('Invalid config — see error below')
    }

    const triggerImport = (): void => fileInputRef.current?.click()
    const firmwareLabel = (fw ?? '').toUpperCase() || 'firmware'

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Configuration Export"
            subtitle="Compile your keymap to firmware config"
            headerIcon={<DownloadIcon />}
            customModalBoxClass="w-11/14 max-w-2xl"
            type="icon"
            icon={<DownloadIcon />}
            variant="ghost"
            showFooter={false}
        >
            <div className="space-y-6">
                {/* status */}
                <div className="flex items-center gap-3 rounded-xl border bg-background p-4">
                    <span
                        data-ready={!!config || !!service}
                        className="size-2 shrink-0 rounded-full bg-muted-foreground data-[ready=true]:bg-emerald-500 data-[ready=true]:shadow-[0_0_8px] data-[ready=true]:shadow-emerald-500/60"
                    />
                    <div className="flex-1">
                        <div className="text-[13px] font-semibold">
                            {config
                                ? config.meta.name
                                : service
                                  ? service.deviceInfo.name
                                  : 'No config loaded'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {config
                                ? `${config.layers.length} layer${
                                      config.layers.length === 1 ? '' : 's'
                                  } · source of truth`
                                : service
                                  ? `${firmwareLabel} device · native export`
                                  : 'Connect a keyboard or import a .json config'}
                        </div>
                    </div>
                    {(config || service) && (
                        <FileText className="size-4 text-emerald-500" />
                    )}
                </div>

                {config && (
                    <ExportPanel
                        config={config}
                        source={source}
                        targets={allowed}
                    />
                )}

                {!config && service && (
                    <div>
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Export
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                onClick={handleNativeExport}
                                className="flex items-center gap-2"
                            >
                                <DownloadIcon className="h-4 w-4" />
                                Download {firmwareLabel} config
                            </Button>
                            <Button
                                onClick={handleNativeCopy}
                                variant="outline"
                                className="flex items-center gap-2"
                            >
                                <Copy className="h-4 w-4" />
                                Copy
                            </Button>
                        </div>
                    </div>
                )}

                <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Import
                    </p>
                    <Button
                        onClick={triggerImport}
                        variant="outline"
                        className="flex items-center gap-2"
                    >
                        <Upload className="h-4 w-4" />
                        Import .json
                    </Button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,.txt"
                        className="hidden"
                        onChange={handleImportSource}
                    />
                </div>

                {error && (
                    <div className="flex gap-2 rounded-lg border border-red-500/40 bg-red-500/5 p-2 text-xs">
                        <AlertTriangle className="size-3.5 shrink-0 text-red-500" />
                        <span>
                            <span className="font-semibold">Import:</span>{' '}
                            {error}
                        </span>
                    </div>
                )}

                <Separator />

                {/* instructions */}
                <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Flash to your keyboard
                    </p>
                    <ol className="space-y-2.5 text-sm text-muted-foreground">
                        {[
                            'Download a firmware tab\'s "project (.zip)" for a ready-to-build repo (config + GitHub Actions workflow + README).',
                            'Push the project to a new GitHub repository.',
                            'GitHub Actions builds it automatically — or build locally per the README.',
                            'Download the firmware artifact and flash it to your keyboard.',
                        ].map((step, i) => (
                            <li key={i} className="flex gap-3">
                                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-secondary font-mono text-[11px] font-bold text-foreground">
                                    {i + 1}
                                </span>
                                <span className="pt-0.5">{step}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </Modal>
    )
}
