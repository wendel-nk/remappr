import { useMemo } from 'react'

import type { Transport } from '@firmware'
import type { TransportFactory } from '@/transport/types'
import { ExternalLink } from '@/components/ExternalLink'
import { DeviceList } from './DeviceList.tsx'
import { DevicePicker } from './DevicePicker'
// pattern-check: skip — mechanical rename TRANSPORTS -> getTransports()
import { getTransports } from '@/lib/transports'
import { Modal } from '@/ui/modal'

export interface ConnectModalProps {
    open?: boolean
    onTransportCreated: (
        t: Transport,
        communication: 'serial' | 'ble' | 'hid',
    ) => void
}

export const ConnectModal = ({
    open,
    onTransportCreated,
}: ConnectModalProps): JSX.Element => {
    const transports = useMemo(() => getTransports(), [])
    const haveTransports = useMemo(() => transports.length > 0, [transports])

    function connectOptions(
        transports: TransportFactory[],
        onTransportCreated: (
            t: Transport,
            communication: 'serial' | 'ble' | 'hid',
        ) => void,
        open?: boolean,
    ): JSX.Element {
        const useSimplePicker = transports.every(
            (t): boolean => !t.pick_and_connect,
        )

        return useSimplePicker ? (
            <DevicePicker
                transports={transports}
                onTransportCreated={onTransportCreated}
            />
        ) : (
            <DeviceList
                open={open || false}
                transports={transports}
                onTransportCreated={onTransportCreated}
            ></DeviceList>
        )
    }

    function noTransportsOptionsPrompt(): JSX.Element {
        return (
            <div className="m-4 flex flex-col gap-2">
                <p>
                    Your browser is not supported. Remappr uses either{' '}
                    <ExternalLink href="https://caniuse.com/web-serial">
                        Web Serial
                    </ExternalLink>{' '}
                    or{' '}
                    <ExternalLink href="https://caniuse.com/web-bluetooth">
                        Web Bluetooth
                    </ExternalLink>{' '}
                    (Linux only) to connect to keyboard devices.
                </p>

                <div>
                    <p>To use Remappr, either:</p>
                    <ul className="list-disc list-inside">
                        <li>
                            Use a browser that supports the above web
                            technologies, e.g. Chrome/Edge, or
                        </li>
                        <li>
                            Download our{' '}
                            <ExternalLink href="/download">
                                cross platform application
                            </ExternalLink>
                            .
                        </li>
                    </ul>
                </div>
            </div>
        )
    }

    return (
        <Modal
            opened={open}
            close={false}
            xButton={false}
            success={false}
            customModalBoxClass="w-11/14 max-w-2xl"
            isDismissable={true}
        >
            <h1 className="text-xl text-center">Welcome to Remappr</h1>
            {haveTransports
                ? connectOptions(transports, onTransportCreated, open)
                : noTransportsOptionsPrompt()}
        </Modal>
    )
}
