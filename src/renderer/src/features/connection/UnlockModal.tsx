import { useMemo } from 'react'

import { LockState } from '@zmkfirmware/zmk-studio-ts-client/core'
import { ExternalLink } from '@/utils/ExternalLink.tsx'
import useConnectionStore from '@/stores/connectionStore.ts'
import { Modal } from '@/ui/modal.tsx'

export const UnlockModal = (): JSX.Element => {
    const { connection, lockState } = useConnectionStore()
    const open = useMemo(
        (): boolean =>
            !!connection &&
            lockState != LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED,
        [connection, lockState],
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
