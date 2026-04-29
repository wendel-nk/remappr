// pattern-check: skip refactor — Download modal calls service.exportConfig() instead of importing ZMK generators directly
import { useEffect, useState } from 'react'
import { Download as DownloadIcon, Copy, FileText } from 'lucide-react'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Separator } from '@/ui/separator'
import { toast } from 'sonner'
import useConnectionStore from '@/stores/connectionStore'
import type { ExportedFile, Keymap } from '@firmware/types'
import { isUnlocked } from '@firmware'

interface DownloadProps {
    opened?: boolean
    onClose?: () => void
}

function exportedContentToString(content: string | Uint8Array): string {
    if (typeof content === 'string') return content
    return new TextDecoder().decode(content)
}

function downloadExports(files: ExportedFile[]): void {
    files.forEach((f, i) => {
        const part: BlobPart =
            typeof f.content === 'string'
                ? f.content
                : new Uint8Array(
                      f.content.buffer.slice(
                          f.content.byteOffset,
                          f.content.byteOffset + f.content.byteLength,
                      ) as ArrayBuffer,
                  )
        const blob = new Blob([part], { type: f.mime })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = f.filename
        document.body.appendChild(link)
        setTimeout((): void => {
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
        }, i * 100)
    })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Download(_props: DownloadProps): JSX.Element {
    const { service, lockState } = useConnectionStore()

    const [keymap, setKeymap] = useState<Keymap | undefined>(undefined)
    useEffect(() => {
        if (!service || !isUnlocked(lockState)) {
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
                console.error('Failed to fetch keymap for download', e)
            }
        })()
        return (): void => {
            cancelled = true
        }
    }, [service, lockState])

    const handleGenerateConfig = async (): Promise<void> => {
        if (!service) {
            toast.error(
                'No keymap data available. Please connect to a keyboard first.',
            )
            return
        }
        try {
            const files = await service.exportConfig()
            downloadExports(files)
            toast.success('Configuration files downloaded successfully!')
        } catch (error) {
            console.error('Error generating config:', error)
            toast.error('Failed to generate configuration files')
        }
    }

    const handleCopyToClipboard = async (): Promise<void> => {
        if (!service) {
            toast.error(
                'No keymap data available. Please connect to a keyboard first.',
            )
            return
        }
        try {
            const files = await service.exportConfig()
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
            console.error('Error copying to clipboard:', error)
            toast.error('Failed to copy to clipboard')
        }
    }

    const isConnected = !!service && !!keymap

    return (
        <Modal
            customModalBoxClass="w-11/14 max-w-4xl"
            type="icon"
            icon={<DownloadIcon />}
            variant="ghost"
        >
            <div className="space-y-6">
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">
                        Configuration Export{' '}
                        <span className={'text-red-600'}>
                            (This is not a functional system yet!!)
                        </span>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Generate firmware configuration files for your keyboard
                        layout. The file format is determined by the connected
                        firmware adapter.
                    </p>

                    {!isConnected && (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                Connect to a keyboard to generate configuration
                                files
                            </p>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <Button
                            onClick={handleGenerateConfig}
                            disabled={!isConnected}
                            className="flex items-center gap-2"
                        >
                            <DownloadIcon className="h-4 w-4" />
                            Download Config Files
                        </Button>
                        <Button
                            onClick={handleCopyToClipboard}
                            disabled={!isConnected}
                            variant="outline"
                            className="flex items-center gap-2"
                        >
                            <Copy className="h-4 w-4" />
                            Copy Primary File to Clipboard
                        </Button>
                    </div>

                    {isConnected && (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <FileText className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                                    Configuration Ready
                                </span>
                            </div>
                            <p className="text-sm text-green-700 dark:text-green-300">
                                Found {keymap?.layers?.length || 0} layers.
                                Export formats:{' '}
                                {service?.capabilities.exportFormats.join(
                                    ', ',
                                ) ?? 'none'}
                            </p>
                        </div>
                    )}
                </div>

                <Separator />

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">
                        Usage Instructions
                    </h3>
                    <div className="space-y-3 text-sm text-muted-foreground">
                        <div>
                            <strong>1. Generate Configuration:</strong> Click
                            &quot;Download Config Files&quot; to get your
                            firmware configuration files.
                        </div>
                        <div>
                            <strong>2. Copy to firmware repo:</strong> Place the
                            downloaded files in your firmware configuration
                            repository.
                        </div>
                        <div>
                            <strong>3. Build Firmware:</strong> Push to your
                            firmware build pipeline to produce a flashable
                            artifact.
                        </div>
                        <div>
                            <strong>4. Flash Keyboard:</strong> Download and
                            flash the built firmware to your keyboard.
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    )
}
