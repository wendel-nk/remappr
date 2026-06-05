// Pattern check: no GoF pattern (-) — rejected — thin modal wrapper around the
// shared ExportPanel core; only frames it with a title + "Open in editor", no
// new abstraction.
//
// The builder's "Export & build" modal. The tabbed preview / compile / download
// body is the shared ExportPanel (components/modals/ExportPanel); this wrapper
// adds the builder-specific framing: the modal chrome + an "Open in editor"
// hand-off to the keymap editor.
import { useMemo } from 'react'
import { ArrowRight, Download } from 'lucide-react'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import { type ConfigKeymap, type Target } from '@firmware/config'
import useBuilderStore from '@/stores/builderStore'
import useConfigStore from '@/stores/configStore'
import { ExportPanel } from '@/components/modals/ExportPanel'

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

interface BuilderExportModalProps {
    open: boolean
    onClose: () => void
}

export function BuilderExportModal({
    open,
    onClose,
}: BuilderExportModalProps): JSX.Element | null {
    const cfg = useConfigStore((s) => s.config)
    const source = useConfigStore((s) => s.source)
    const openInEditor = useBuilderStore((s) => s.openInEditor)

    const targets = useMemo<Target[]>(
        () => (cfg ? compilerTargets(cfg) : []),
        [cfg],
    )

    if (!open || !cfg) return null

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
                <ExportPanel config={cfg} source={source} targets={targets} />

                {/* footer — builder-specific hand-off to the editor */}
                <div className="flex items-center border-t border-border pt-4">
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
                </div>
            </div>
        </Modal>
    )
}
