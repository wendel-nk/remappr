import { useMemo } from 'react'

import { ExternalLink } from '@/components/ExternalLink'
import useConnectionStore from '@/stores/connectionStore'
import { Modal } from '@/ui/modal'

export const UnlockModal = (): JSX.Element => {
    const { service, lockState } = useConnectionStore()
    const open = useMemo(
        (): boolean => !!service && lockState != 'unlocked',
        [service, lockState],
    )

    return (
        <Modal
            opened={open}
            xButton={false}
            showFooter={false}
            isDismissable={true}
            title="Unlock To Continue"
        >
            <p>
                For security reasons, your keyboard requires unlocking before
                using Remappr.
            </p>
            <p>
                If studio unlocking hasn&apos;t been added to your keymap or a
                combo, see the{' '}
                <ExternalLink href="https://zmk.dev/docs/keymaps/behaviors/studio-unlock">
                    Studio Unlock Behavior
                </ExternalLink>{' '}
                documentation for more infomation.
            </p>
        </Modal>
    )
}
