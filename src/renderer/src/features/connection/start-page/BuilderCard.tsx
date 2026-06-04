// Pattern check: no GoF pattern (-) — rejected — presentational start-page CTA
// banner gated on usePremium(); opens the full-screen builder via builderStore.
//
// The "Create a keyboard" entry, ported 1:1 from the design prototype's
// full-width gradient banner. Visible to everyone (doubles as an upsell), but
// the builder only opens with a premium entitlement — otherwise it toasts the
// locked state. Opening flips builderStore.open; App swaps the start page for
// the full-screen <FullScreenBuilder/>.
import { ArrowRight, Lock, Ruler } from 'lucide-react'
import { toast } from 'sonner'
import { usePremium } from '@/hooks/use-premium'
import useBuilderStore from '@/stores/builderStore'

export function BuilderCard(): JSX.Element {
    const premium = usePremium()
    const setOpen = useBuilderStore((s) => s.setOpen)

    const onOpen = (): void => {
        if (!premium) {
            toast.info('Build from scratch is premium', {
                description:
                    'The keyboard builder is owner-only for now. A license key unlocks it locally.',
            })
            return
        }
        setOpen(true)
    }

    return (
        <button
            type="button"
            onClick={onOpen}
            className="group mt-4 flex w-full items-center gap-4 rounded-2xl border px-[18px] py-4 text-left text-foreground transition-all hover:-translate-y-0.5"
            style={{
                background:
                    'linear-gradient(100deg, color-mix(in oklch, var(--primary) 16%, var(--card)), var(--card) 70%)',
                borderColor:
                    'color-mix(in oklch, var(--primary) 38%, var(--border))',
            }}
        >
            <span
                className="grid size-[46px] shrink-0 place-items-center rounded-xl text-white"
                style={{
                    background:
                        'linear-gradient(150deg, var(--primary), color-mix(in oklch, var(--primary) 65%, #000))',
                }}
            >
                <Ruler size={22} />
            </span>
            <div className="flex-1">
                <div className="flex items-center gap-2.5">
                    <span className="text-[15.5px] font-bold">
                        Create a keyboard
                    </span>
                    <span
                        className="rounded-full px-[7px] py-0.5 text-[10px] font-bold text-primary"
                        style={{
                            background:
                                'color-mix(in oklch, var(--primary) 16%, transparent)',
                        }}
                    >
                        BUILDER
                    </span>
                </div>
                <div className="mt-1 text-[13px] text-muted-foreground">
                    Design a board from scratch — layout, matrix &amp; firmware.
                    Import KLE, start from a preset, then export a build-ready
                    config.
                </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground">
                {premium ? (
                    <>
                        Open builder <ArrowRight size={15} />
                    </>
                ) : (
                    <>
                        <Lock size={14} /> Premium
                    </>
                )}
            </span>
        </button>
    )
}
