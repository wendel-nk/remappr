// Pattern check: no GoF pattern (-) — rejected — container wiring the hardware
// form to configStore via existing hooks; state plumbing, no abstraction.
//
// The Keyboard Builder. Today it edits the connected/imported config's BOARD
// HARDWARE (board + kscan wiring) so remappr can compile a flashable ZMK overlay
// (real kscan + chosen + matrix-transform) instead of the geometry-derived
// scaffold — see firmware/config/compilers/zmk.ts. The full from-scratch geometry
// editor (placing keys/encoders into `keyboard.keys`) is a later phase; until then
// the panel requires a loaded config to attach hardware to.
import { useState } from 'react'
import { Hammer } from 'lucide-react'
import { toast } from 'sonner'
import { serializeKeymap, type ConfigKeymap } from '@firmware/config'
import { Modal } from '@/ui/modal'
import { Button } from '@/ui/button'
import useConfigStore from '@/stores/configStore'
import { HardwareForm } from './HardwareForm'
import {
    draftToHardware,
    hardwareToDraft,
    type HardwareDraft,
} from './hardwareForm'

interface KeyboardBuilderProps {
    opened: boolean
    onClose: () => void
}

// Drop the hardware key, then re-add it only when the draft produced one — so a
// cleared form removes the block instead of leaving a stale one.
function withHardware(
    config: ConfigKeymap,
    draft: HardwareDraft,
): ConfigKeymap {
    const hw = draftToHardware(draft, config.keyboard.hardware?.transform)
    const keyboard = { ...config.keyboard }
    delete keyboard.hardware
    if (hw) keyboard.hardware = hw
    return { ...config, keyboard }
}

export function KeyboardBuilder({
    opened,
    onClose,
}: KeyboardBuilderProps): JSX.Element {
    const config = useConfigStore((s) => s.config)
    const loadFromSource = useConfigStore((s) => s.loadFromSource)
    const [draft, setDraft] = useState<HardwareDraft>(() =>
        hardwareToDraft(config?.keyboard.hardware),
    )
    const [error, setError] = useState<string | null>(null)

    // Re-seed the draft from the current config on the closed→open transition,
    // adjusting state during render (React's sanctioned alternative to a
    // setState-in-effect) so a stale draft never flashes when the modal reopens.
    const [wasOpen, setWasOpen] = useState(opened)
    if (opened !== wasOpen) {
        setWasOpen(opened)
        if (opened) {
            setDraft(hardwareToDraft(config?.keyboard.hardware))
            setError(null)
        }
    }

    const save = (): void => {
        if (!config) return
        const next = withHardware(config, draft)
        // Round-trip through the validator so the schema's cross-checks
        // (transform vs key count, GPIO counts) gate the save.
        const ok = loadFromSource(serializeKeymap(next))
        if (ok) {
            setError(null)
            toast.success('Board hardware saved')
            onClose()
        } else {
            setError(useConfigStore.getState().error)
        }
    }

    const footer = config ? (
        <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
                Cancel
            </Button>
            <Button onClick={save}>Save hardware</Button>
        </div>
    ) : undefined

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Keyboard Builder"
            subtitle="Define the board hardware for a flashable export"
            headerIcon={<Hammer />}
            customModalBoxClass="w-11/14 max-w-2xl"
            showFooter={Boolean(config)}
            footer={footer}
        >
            {config ? (
                <div className="space-y-4">
                    <HardwareForm
                        value={draft}
                        onChange={setDraft}
                        keyCount={config.keyboard.keys.length}
                    />
                    {error && (
                        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                            {error}
                        </p>
                    )}
                </div>
            ) : (
                <div className="grid place-items-center gap-3 py-12 text-center">
                    <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Hammer className="size-6" />
                    </span>
                    <div className="space-y-1">
                        <p className="text-sm font-semibold">
                            No keymap loaded
                        </p>
                        <p className="mx-auto max-w-sm text-xs text-muted-foreground">
                            Connect a keyboard or import a keymap first, then
                            the builder can attach its board hardware (kscan
                            wiring, diode direction, debounce) for a flashable
                            ZMK export. Building geometry from scratch is coming
                            in a later release.
                        </p>
                    </div>
                </div>
            )}
        </Modal>
    )
}
