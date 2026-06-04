// Pattern check: no GoF pattern (-) — rejected — presentational tabbed export
// modal; per-target compilation delegates to the existing getCompiler() Strategy
// (firmware/config/compiler.ts) + serializeKeymap, no new abstraction.
//
// The builder's "Export & build" modal, ported from the prototype
// (BuilderPanels.jsx → BuilderExportModal). Tabs:
//   • Remappr config — serializeKeymap (the source-of-truth .json).
//   • one per compiler target the firmware selection maps to (qmk/via/vial→QMK,
//     zmk→ZMK, plus the pinned meta.target which may be Keychron) — via getCompiler.
//   • GitHub build — reuse CloudBuildPanel (push → Actions → firmware artifact).
// Footer: "Open in editor" hands the board to the keymap editor.
import { useMemo, useState } from 'react'
import { ArrowRight, Code2, Copy, Download, GitBranch } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/ui/tabs'
import { downloadExports, exportedContentToString } from '@/lib/blob'
import {
    type CompileResult,
    type ConfigKeymap,
    type Target,
    formatPath,
    getCompiler,
    serializeKeymap,
} from '@firmware/config'
import { createLogger } from '@shared/logger'
import useBuilderStore from '@/stores/builderStore'
import useConfigStore from '@/stores/configStore'
import { slugifyId } from './geometryEditor'
import { CloudBuildPanel } from '@/components/modals/CloudBuildPanel'

const log = createLogger('BuilderExport')

const TARGET_LABELS: Record<Target, string> = {
    zmk: 'ZMK',
    qmk: 'QMK',
    keychron: 'Keychron',
}

const NATIVE = 'native'
const CLOUD = 'cloud'

/** Distinct compiler targets the board's firmware selection maps to. The raw
 *  builder firmwares (qmk/via/vial/zmk) collapse onto compilers — via & vial
 *  both export through QMK — plus whatever target meta pins (e.g. Keychron). */
function compilerTargets(config: ConfigKeymap): Target[] {
    const set = new Set<Target>()
    for (const f of config.keyboard.firmware ?? []) {
        set.add(f === 'zmk' ? 'zmk' : 'qmk')
    }
    if (config.meta.target) set.add(config.meta.target)
    if (!set.size) set.add('zmk')
    return [...set]
}

/** Firmwares (other than the obvious one) a compiler tab also covers, for a
 *  small "· covers VIA · Vial" hint so the collapse is visible, not hidden. */
function alsoCovers(config: ConfigKeymap, target: Target): string[] {
    if (target !== 'qmk') return []
    return (config.keyboard.firmware ?? [])
        .filter((f) => f === 'via' || f === 'vial')
        .map((f) => (f === 'via' ? 'VIA' : 'Vial'))
}

interface BuilderExportModalProps {
    open: boolean
    onClose: () => void
}

export function BuilderExportModal({
    open,
    onClose,
}: BuilderExportModalProps): JSX.Element | null {
    const cfg = useConfigStore((s) => s.config)
    const openInEditor = useBuilderStore((s) => s.openInEditor)
    const [tab, setTab] = useState<string>(NATIVE)

    const targets = useMemo<Target[]>(
        () => (cfg ? compilerTargets(cfg) : []),
        [cfg],
    )

    // The active tab can become stale if firmware targets change — fall back to
    // the Remappr config tab rather than rendering an empty target.
    const activeTab =
        tab === NATIVE || tab === CLOUD || targets.includes(tab as Target)
            ? tab
            : NATIVE

    // Compile / serialize for the active tab. A compiler throw becomes a single
    // error diagnostic rather than crashing the modal.
    const view = useMemo(() => {
        if (!cfg || activeTab === CLOUD) return null
        const id = cfg.keyboard.id || slugifyId(cfg.meta.name) || 'remappr'
        if (activeTab === NATIVE) {
            return {
                code: serializeKeymap(cfg),
                filename: `${id}.keymap.json`,
                diagnostics: [] as CompileResult['diagnostics'],
            }
        }
        try {
            const result = getCompiler(activeTab as Target).compile(cfg)
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
    }, [cfg, activeTab])

    if (!open || !cfg) return null

    const handleCopy = async (): Promise<void> => {
        if (!view?.code) {
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

    const handleDownload = (): void => {
        if (!view) return
        downloadExports([
            {
                filename: view.filename,
                mime: view.filename.endsWith('.json')
                    ? 'application/json'
                    : 'text/plain',
                content: view.code,
            },
        ])
        toast.success(`Downloaded ${view.filename}`)
    }

    const hasErrors = view?.diagnostics.some((d) => d.level === 'error')

    return (
        <Modal
            opened={open}
            onClose={onClose}
            title="Export & build"
            subtitle={cfg.meta.name}
            headerIcon={<Download />}
            customModalBoxClass="w-11/14 max-w-2xl"
            showFooter={false}
        >
            <div className="space-y-5">
                <Tabs value={activeTab} onValueChange={setTab}>
                    <TabsList className="flex h-auto flex-wrap">
                        <TabsTrigger value={NATIVE}>Remappr config</TabsTrigger>
                        {targets.map((t) => (
                            <TabsTrigger key={t} value={t}>
                                {TARGET_LABELS[t]}
                            </TabsTrigger>
                        ))}
                        <TabsTrigger value={CLOUD}>GitHub build</TabsTrigger>
                    </TabsList>
                </Tabs>

                {activeTab === CLOUD ? (
                    <CloudBuildPanel
                        config={cfg}
                        target={targets[0] ?? 'zmk'}
                    />
                ) : (
                    <>
                        {/* note line */}
                        <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                            <Code2 className="size-3.5 shrink-0" />
                            {activeTab === NATIVE ? (
                                <span>
                                    The source-of-truth config — drop it into
                                    your repo as the downloadable keymap.
                                </span>
                            ) : (
                                <span>
                                    Ready-to-build{' '}
                                    {TARGET_LABELS[activeTab as Target]} config.
                                    {alsoCovers(cfg, activeTab as Target)
                                        .length > 0 &&
                                        ` · covers ${alsoCovers(
                                            cfg,
                                            activeTab as Target,
                                        ).join(' · ')}`}
                                </span>
                            )}
                        </div>

                        {/* code preview */}
                        <pre className="m-0 max-h-[42vh] overflow-auto rounded-xl border border-border bg-[oklch(0.16_0_0)] p-3.5 font-mono text-[12px] leading-relaxed text-[oklch(0.9_0_0)]">
                            <code>{view?.code || '— empty —'}</code>
                        </pre>

                        {/* diagnostics */}
                        {view && view.diagnostics.length > 0 && (
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
                    </>
                )}

                {/* footer actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                    <Button
                        variant="outline"
                        onClick={() => {
                            openInEditor()
                            onClose()
                        }}
                        className="flex items-center gap-2"
                    >
                        <ArrowRight className="size-4" /> Open in editor
                    </Button>
                    {activeTab !== CLOUD && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={handleCopy}
                                disabled={!view?.code}
                                className="flex items-center gap-2"
                            >
                                <Copy className="size-4" /> Copy
                            </Button>
                            <Button
                                onClick={handleDownload}
                                disabled={!view?.code || hasErrors}
                                className="flex items-center gap-2"
                            >
                                {activeTab === NATIVE ? (
                                    <Download className="size-4" />
                                ) : (
                                    <GitBranch className="size-4" />
                                )}
                                Download {view?.filename}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    )
}
