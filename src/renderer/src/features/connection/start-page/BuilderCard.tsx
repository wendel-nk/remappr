// Pattern check: no GoF pattern (-) — rejected — presentational entry that gates
// on usePremium() and composes FeatureCard; no abstraction.
//
// The "Build from scratch" start-page entry. Visible to everyone (it doubles as
// an upsell), but the builder only opens with a premium entitlement — otherwise
// the card shows a locked state. Real billing/unlock flow plugs into the
// entitlements seam (src/renderer/src/lib/entitlements) later.
import { useState } from 'react'
import { Lock, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/ui/button'
import { usePremium } from '@/hooks/use-premium'
import { KeyboardBuilder } from '@/features/builder'
import { FeatureCard } from './FeatureCard'

export function BuilderCard(): JSX.Element {
    const premium = usePremium()
    const [open, setOpen] = useState(false)

    return (
        <>
            <FeatureCard
                title="Build from scratch"
                description={
                    premium
                        ? 'Design a custom keyboard layout from the ground up.'
                        : 'Design a custom keyboard layout. A premium feature.'
                }
                action={
                    premium ? (
                        <Button
                            onClick={() => setOpen(true)}
                            className="flex items-center gap-2"
                        >
                            <Sparkles className="h-4 w-4" />
                            Open builder
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={() =>
                                toast.info('Build from scratch is premium', {
                                    description:
                                        'The keyboard builder is owner-only for now. A license key unlocks it locally.',
                                })
                            }
                            className="flex items-center gap-2"
                        >
                            <Lock className="h-4 w-4" />
                            Premium
                        </Button>
                    )
                }
            />
            {premium && (
                <KeyboardBuilder opened={open} onClose={() => setOpen(false)} />
            )}
        </>
    )
}
