// pattern-check: skip — UI rewrite; compile target selection delegates to the
// existing getCompiler() Strategy (firmware/config/compiler.ts), no new abstraction.
import { useMemo, useRef, useState } from 'react'
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
import {
    type CompileResult,
    type Target,
    formatPath,
    getCompiler,
    resolveAllowedTargets,
    serializeKeymap,
} from '@firmware/config'
import type { ExportedFile } from '@firmware/types'
import { createLogger } from '@shared/logger'

const log = createLogger('Download')

const TARGET_LABELS: Record<Target, string> = {
    zmk: 'ZMK',
    qmk: 'QMK',
    keychron: 'Keychron',
}

interface DownloadProps {
    opened?: boolean
    onClose?: () => void
}

export function Download({ opened, onClose }: DownloadProps): JSX.Element {
    const { service } = useConnectionStore()
    const { config, error, loadFromSource } = useConfigStore()
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

    // Derive the effective target instead of syncing via an effect: the user's
    // pick wins while it's still allowed, else fall back to the first allowed.
    const [picked, setPicked] = useState<Target>('zmk')
    const target = allowed.includes(picked) ? picked : (allowed[0] ?? 'zmk')

    // Compile is pure over (config, target); recompute on either change. A throw
    // becomes a synthetic error diagnostic rather than crashing the modal.
    const result = useMemo<CompileResult | null>(() => {
        if (!config) return null
        try {
            return getCompiler(target).compile(config)
        } catch (e) {
            log.error('compile failed', e)
            return {
                files: [],
                diagnostics: [
                    {
                        level: 'error',
                        message: e instanceof Error ? e.message : String(e),
                        path: [],
                    },
                ],
            }
        }
    }, [config, target])

    const hasErrors = result?.diagnostics.some((d) => d.level === 'error')
    const canCompile = !!config && !!result && !hasErrors

    const handleDownload = (): void => {
        if (!result) return
        downloadExports(result.files)
        toast.success(`${TARGET_LABELS[target]} config downloaded`)
    }

    const handleCopy = async (): Promise<void> => {
        const primary = result?.files[0]
        if (!primary) {
            toast.error('Nothing to copy')
            return
        }
        try {
            await navigator.clipboard.writeText(
                exportedContentToString(primary.content),
            )
            toast.success(`${primary.filename} copied`)
        } catch (e) {
            log.error('copy failed', e)
            toast.error('Failed to copy to clipboard')
        }
    }

    const handleExportSource = (): void => {
        if (!config) return
        const file: ExportedFile = {
            filename: `${config.keyboard.id || 'remappr'}.keymap.json`,
            mime: 'application/json',
            content: serializeKeymap(config),
        }
        downloadExports([file])
        toast.success('Config (.json) exported')
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

    // pattern-check: skip — native-export fallback handlers, no abstraction
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
                    <>
                        {/* target picker */}
                        <div>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                Target firmware
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {allowed.map((t) => (
                                    <Button
                                        key={t}
                                        onClick={() => setPicked(t)}
                                        variant={
                                            t === target ? 'default' : 'outline'
                                        }
                                        size="sm"
                                    >
                                        {TARGET_LABELS[t]}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* export actions */}
                        <div>
                            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                Export
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    onClick={handleDownload}
                                    disabled={!canCompile}
                                    className="flex items-center gap-2"
                                >
                                    <DownloadIcon className="h-4 w-4" />
                                    Download {TARGET_LABELS[target]} config
                                </Button>
                                <Button
                                    onClick={handleCopy}
                                    disabled={!canCompile}
                                    variant="outline"
                                    className="flex items-center gap-2"
                                >
                                    <Copy className="h-4 w-4" />
                                    Copy
                                </Button>
                                <Button
                                    onClick={handleExportSource}
                                    variant="outline"
                                    className="flex items-center gap-2"
                                >
                                    <FileText className="h-4 w-4" />
                                    Export .json
                                </Button>
                            </div>
                        </div>
                    </>
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

                {(config || error) && (
                    <DiagnosticsPanel result={result} importError={error} />
                )}

                <Separator />

                {/* instructions */}
                <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Flash to your keyboard
                    </p>
                    <ol className="space-y-2.5 text-sm text-muted-foreground">
                        {[
                            'Download the firmware config files above.',
                            'Place them in your firmware configuration repository.',
                            'Push to your firmware build pipeline to produce a flashable artifact.',
                            'Download and flash the built firmware to your keyboard.',
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

function DiagnosticsPanel({
    result,
    importError,
}: {
    result: CompileResult | null
    importError: string | null
}): JSX.Element | null {
    const diags = result?.diagnostics ?? []
    if (!importError && diags.length === 0) {
        return (
            <p className="text-xs text-muted-foreground">
                No issues — this config compiles cleanly for the selected
                target.
            </p>
        )
    }
    return (
        <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Diagnostics
            </p>
            <ul className="space-y-1.5">
                {importError && (
                    <li className="flex gap-2 rounded-lg border border-red-500/40 bg-red-500/5 p-2 text-xs">
                        <AlertTriangle className="size-3.5 shrink-0 text-red-500" />
                        <span>
                            <span className="font-semibold">Import:</span>{' '}
                            {importError}
                        </span>
                    </li>
                )}
                {diags.map((d, i) => (
                    <li
                        key={i}
                        data-level={d.level}
                        className="flex gap-2 rounded-lg border p-2 text-xs data-[level=error]:border-red-500/40 data-[level=error]:bg-red-500/5 data-[level=warn]:border-amber-500/40 data-[level=warn]:bg-amber-500/5"
                    >
                        <AlertTriangle
                            className={
                                'size-3.5 shrink-0 ' +
                                (d.level === 'error'
                                    ? 'text-red-500'
                                    : 'text-amber-500')
                            }
                        />
                        <span>
                            {d.path.length > 0 && (
                                <span className="font-mono font-semibold">
                                    {formatPath(d.path)}:{' '}
                                </span>
                            )}
                            {d.message}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
