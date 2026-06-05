// Pattern check: no GoF pattern (-) — rejected — presentational shared export
// panel; per-target compilation delegates to the existing getCompiler() Strategy
// (firmware/config/compiler.ts) + buildProjectBundle + preferredSourceJson, no
// new abstraction.
//
// The shared core of BOTH export surfaces (editor Download + builder
// BuilderExportModal): a tabbed code preview with copy / download-config /
// download-project actions and inline diagnostics. Tabs:
//   • Remappr config — the source-of-truth .json (the user's literal text when
//     it's still in sync, else a fresh canonical serialize).
//   • one per compiler target — the ready-to-build firmware config. Its primary
//     download is the FULL project (.zip): config + GitHub Actions workflow +
//     README, so a push to GitHub builds the firmware on its own.
import { useMemo, useState } from 'react'
import { Code2, Copy, Download, FileJson, Package } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs'
import { downloadExports, exportedContentToString } from '@/lib/blob'
import { zipStore } from '@/lib/zip'
import {
    type CompileResult,
    type ConfigKeymap,
    type Target,
    buildProjectBundle,
    formatPath,
    getCompiler,
    preferredSourceJson,
} from '@firmware/config'
import { createLogger } from '@shared/logger'

const log = createLogger('ExportPanel')

const TARGET_LABELS: Record<Target, string> = {
    zmk: 'ZMK',
    qmk: 'QMK',
    keychron: 'Keychron',
}

const NATIVE = 'native'

/** Firmwares (other than the obvious one) a compiler tab also covers, for a
 *  small "· covers VIA · Vial" hint so the qmk→via/vial collapse is visible. */
function alsoCovers(config: ConfigKeymap, target: Target): string[] {
    if (target !== 'qmk') return []
    return (config.keyboard.firmware ?? [])
        .filter((f) => f === 'via' || f === 'vial')
        .map((f) => (f === 'via' ? 'VIA' : 'Vial'))
}

const configId = (config: ConfigKeymap): string =>
    config.keyboard.id || 'remappr'

interface ExportPanelProps {
    config: ConfigKeymap
    /** Raw JSON the config was parsed from, for verbatim "Remappr config" export. */
    source: string | null
    /** Compiler targets to offer tabs for (defaults to ZMK). */
    targets: Target[]
}

export function ExportPanel({
    config,
    source,
    targets,
}: ExportPanelProps): JSX.Element {
    const [tab, setTab] = useState<string>(NATIVE)

    // The active tab can go stale if targets change — fall back to the config tab.
    const activeTab =
        tab === NATIVE || targets.includes(tab as Target) ? tab : NATIVE

    // Compile / serialize for the active tab. A compiler throw becomes a single
    // error diagnostic rather than crashing the panel.
    const view = useMemo(() => {
        const id = configId(config)
        if (activeTab === NATIVE) {
            return {
                code: preferredSourceJson(config, source),
                filename: `${id}.keymap.json`,
                diagnostics: [] as CompileResult['diagnostics'],
            }
        }
        try {
            const result = getCompiler(activeTab as Target).compile(config)
            const primary = result.files[0]
            return {
                code: primary ? exportedContentToString(primary.content) : '',
                filename: primary?.filename ?? `${id}.txt`,
                diagnostics: result.diagnostics,
            }
        } catch (e) {
            log.error('compile failed', e)
            return {
                code: '',
                filename: `${id}.txt`,
                diagnostics: [
                    {
                        level: 'error' as const,
                        message: e instanceof Error ? e.message : String(e),
                        path: [],
                    },
                ],
            }
        }
    }, [config, source, activeTab])

    const hasErrors = view.diagnostics.some((d) => d.level === 'error')
    const isNative = activeTab === NATIVE

    const handleCopy = async (): Promise<void> => {
        if (!view.code) {
            toast.error('Nothing to copy')
            return
        }
        try {
            await navigator.clipboard.writeText(view.code)
            toast.success(`${view.filename} copied`)
        } catch (e) {
            log.error('copy failed', e)
            toast.error('Failed to copy to clipboard')
        }
    }

    // The "Remappr config" tab downloads the single .json; a compiler tab
    // downloads the firmware config file(s) on their own (no scaffolding).
    const handleDownloadConfig = (): void => {
        if (isNative) {
            downloadExports([
                {
                    filename: view.filename,
                    mime: 'application/json',
                    content: view.code,
                },
            ])
            toast.success(`Downloaded ${view.filename}`)
            return
        }
        try {
            const result = getCompiler(activeTab as Target).compile(config)
            downloadExports(result.files)
            toast.success(
                `${TARGET_LABELS[activeTab as Target]} config downloaded`,
            )
        } catch (e) {
            log.error('download failed', e)
            toast.error('Failed to compile config')
        }
    }

    // A compiler tab's primary action: the whole buildable repo as one .zip —
    // config + .github/workflows + README — ready to push to GitHub Actions.
    const handleDownloadProject = (): void => {
        try {
            const bundle = buildProjectBundle(config, activeTab as Target)
            const zip = zipStore(
                bundle.files.map((f) => ({
                    path: `${bundle.rootName}/${f.filename}`,
                    data:
                        typeof f.content === 'string'
                            ? new TextEncoder().encode(f.content)
                            : f.content,
                })),
            )
            downloadExports([
                {
                    filename: `${bundle.rootName}.zip`,
                    mime: 'application/zip',
                    content: zip,
                },
            ])
            toast.success('Project bundle downloaded')
        } catch (e) {
            log.error('bundle failed', e)
            toast.error('Failed to build project bundle')
        }
    }

    return (
        <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setTab}>
                <TabsList className="flex h-auto flex-wrap">
                    <TabsTrigger value={NATIVE}>Remappr config</TabsTrigger>
                    {targets.map((t) => (
                        <TabsTrigger key={t} value={t}>
                            {TARGET_LABELS[t]}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {/* note line */}
            <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <Code2 className="size-3.5 shrink-0" />
                {isNative ? (
                    <span>
                        The source-of-truth config — drop it into your repo as
                        the downloadable keymap.
                    </span>
                ) : (
                    <span>
                        Ready-to-build {TARGET_LABELS[activeTab as Target]}{' '}
                        config. The project (.zip) includes a GitHub Actions
                        workflow that builds the firmware on push.
                        {alsoCovers(config, activeTab as Target).length > 0 &&
                            ` · covers ${alsoCovers(
                                config,
                                activeTab as Target,
                            ).join(' · ')}`}
                    </span>
                )}
            </div>

            {/* code preview */}
            <pre className="m-0 max-h-[42vh] overflow-auto rounded-xl border border-border bg-[oklch(0.16_0_0)] p-3.5 font-mono text-[12px] leading-relaxed text-[oklch(0.9_0_0)]">
                <code>{view.code || '— empty —'}</code>
            </pre>

            {/* diagnostics */}
            {view.diagnostics.length > 0 && (
                <ul className="space-y-1.5">
                    {view.diagnostics.map((d, i) => (
                        <li
                            key={i}
                            data-level={d.level}
                            className="flex gap-2 rounded-lg border p-2 text-xs data-[level=error]:border-red-500/40 data-[level=error]:bg-red-500/5 data-[level=warn]:border-amber-500/40 data-[level=warn]:bg-amber-500/5"
                        >
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
            )}

            {/* actions */}
            <div className="flex flex-wrap items-center gap-2">
                {isNative ? (
                    <Button
                        onClick={handleDownloadConfig}
                        disabled={!view.code}
                        className="flex items-center gap-2"
                    >
                        <FileJson className="size-4" /> Download {view.filename}
                    </Button>
                ) : (
                    <>
                        <Button
                            onClick={handleDownloadProject}
                            disabled={hasErrors}
                            className="flex items-center gap-2"
                        >
                            <Package className="size-4" /> Download project
                            (.zip)
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleDownloadConfig}
                            disabled={hasErrors}
                            className="flex items-center gap-2"
                        >
                            <Download className="size-4" /> Config only
                        </Button>
                    </>
                )}
                <Button
                    variant="outline"
                    onClick={handleCopy}
                    disabled={!view.code}
                    className="flex items-center gap-2"
                >
                    <Copy className="size-4" /> Copy
                </Button>
            </div>
        </div>
    )
}
