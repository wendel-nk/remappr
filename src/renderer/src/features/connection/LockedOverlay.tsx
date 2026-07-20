// pattern-check: skip — small presentational component, no abstraction warranted
import { ExternalLink } from '@/components/ExternalLink'
import useConnectionStore from '@/stores/connectionStore'
import { Lock } from 'lucide-react'

export const LockedOverlay = (): JSX.Element => {
    const isZmk = useConnectionStore(
        (s) => s.service?.deviceInfo.firmware === 'zmk',
    )

    return (
        <div className="flex h-full w-full items-center justify-center bg-background p-6">
            <div className="max-w-md space-y-4 rounded-lg border bg-card p-8 shadow-lg">
                <div className="flex items-center gap-3">
                    <Lock className="h-6 w-6 text-primary" aria-hidden />
                    <h2 className="text-xl font-semibold">
                        Unlock To Continue
                    </h2>
                </div>
                <p className="text-sm text-muted-foreground">
                    For security reasons, your keyboard requires unlocking
                    before using Remappr.
                </p>
                {isZmk && (
                    <p className="text-sm text-muted-foreground">
                        If studio unlocking hasn&apos;t been added to your
                        keymap or a combo, see the{' '}
                        <ExternalLink href="https://zmk.dev/docs/keymaps/behaviors/studio-unlock">
                            Studio Unlock Behavior
                        </ExternalLink>{' '}
                        documentation for more information.
                    </p>
                )}
            </div>
        </div>
    )
}
