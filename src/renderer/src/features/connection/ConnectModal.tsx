import { useMemo } from 'react'

import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import type { TransportFactory } from '@/transport/types'
import { ExternalLink } from '@/utils/ExternalLink.tsx'
import { DeviceList } from './DeviceList.tsx'
import { SimpleDevicePicker } from './SimpleDevicePicker.tsx'
// pattern-check: skip — mechanical rename TRANSPORTS -> getTransports()
import { getTransports } from '@/lib/transports'
import { Modal } from '@/ui/modal.tsx'

export interface ConnectModalProps {
    open?: boolean
    onTransportCreated: (
        t: RpcTransport,
        communication: 'serial' | 'ble',
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
            t: RpcTransport,
            communication: 'serial' | 'ble',
        ) => void,
        open?: boolean,
    ): JSX.Element {
        const useSimplePicker = transports.every(
            (t): boolean => !t.pick_and_connect,
        )

        return useSimplePicker ? (
            <SimpleDevicePicker
                transports={transports}
                onTransportCreated={onTransportCreated}
            ></SimpleDevicePicker>
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
