// pattern-check: skip refactor — Download modal calls service.exportConfig() instead of importing ZMK generators directly
import { useEffect, useState } from 'react'
import { Copy, Download as DownloadIcon, FileText } from 'lucide-react'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import { toast } from 'sonner'
import useConnectionStore from '@/stores/connectionStore'
import { downloadExports, exportedContentToString } from '@/lib/blob'
import type { Keymap } from '@firmware/types'
import { createLogger } from '@shared/logger'

const log = createLogger('Download')

interface DownloadProps {
    opened?: boolean
    onClose?: () => void
}

export function Download({ opened, onClose }: DownloadProps): JSX.Element {
    const { service } = useConnectionStore()

    const [keymap, setKeymap] = useState<Keymap | undefined>(undefined)
    useEffect(() => {
        if (!service) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setKeymap(undefined)
            return
        }
        let cancelled = false
        ;(async () => {
            try {
                const km = await service.getKeymap()
                if (!cancelled) setKeymap(km)
            } catch (e) {
                log.error('Failed to fetch keymap for download', e)
            }
        })()
        return (): void => {
            cancelled = true
        }
    }, [service])

    const requireService = (): boolean => {
        if (!service) {
            toast.error(
                'No keymap data available. Please connect to a keyboard first.',
            )
            return false
        }
        return true
    }

    const handleGenerateConfig = async (): Promise<void> => {
        if (!requireService()) return
        try {
            const files = await service!.exportConfig()
            downloadExports(files)
            toast.success('Configuration files downloaded successfully!')
        } catch (error) {
            log.error('Error generating config:', error)
            toast.error('Failed to generate configuration files')
        }
    }

    const handleCopyToClipboard = async (): Promise<void> => {
        if (!requireService()) return
        try {
            const files = await service!.exportConfig()
            const primary = files[0]
            if (!primary) {
                toast.error('exportConfig returned no files')
                return
            }
            await navigator.clipboard.writeText(
                exportedContentToString(primary.content),
            )
            toast.success(`${primary.filename} copied to clipboard!`)
        } catch (error) {
            log.error('Error copying to clipboard:', error)
            toast.error('Failed to copy to clipboard')
        }
    }

    const isConnected = !!service && !!keymap

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Configuration Export"
            subtitle="Generate, download or copy your keymap config"
            headerIcon={<DownloadIcon />}
            customModalBoxClass="w-11/14 max-w-2xl"
            type="icon"
            icon={<DownloadIcon />}
            variant="ghost"
            showFooter={false}
        >
            <div className="space-y-6">
                {/* device / status */}
                <div className="flex items-center gap-3 rounded-xl border bg-background p-4">
                    <span
                        data-ready={isConnected}
                        className="size-2 shrink-0 rounded-full bg-muted-foreground data-[ready=true]:bg-emerald-500 data-[ready=true]:shadow-[0_0_8px] data-[ready=true]:shadow-emerald-500/60"
                    />
                    <div className="flex-1">
                        <div className="text-[13px] font-semibold">
                            {isConnected
                                ? 'Configuration ready'
                                : 'No keyboard connected'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {isConnected
                                ? `${keymap?.layers?.length ?? 0} layers · ${
                                      service?.capabilities.exportFormats.join(
                                          ', ',
                                      ) || 'no'
                                  } export format${
                                      (service?.capabilities.exportFormats
                                          .length ?? 0) === 1
                                          ? ''
                                          : 's'
                                  }`
                                : 'Connect a keyboard to generate config files'}
                        </div>
                    </div>
                    {isConnected && (
                        <FileText className="size-4 text-emerald-500" />
                    )}
                </div>

                {/* export */}
                <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Export
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            onClick={handleGenerateConfig}
                            disabled={!isConnected}
                            className="flex items-center gap-2"
                        >
                            <DownloadIcon className="h-4 w-4" />
                            Download .config
                        </Button>
                        <Button
                            onClick={handleCopyToClipboard}
                            disabled={!isConnected}
                            variant="outline"
                            className="flex items-center gap-2"
                        >
                            <Copy className="h-4 w-4" />
                            Copy keymap
                        </Button>
                    </div>
                </div>

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
