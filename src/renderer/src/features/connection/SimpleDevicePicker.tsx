import { useCallback, useEffect, useRef, useState } from 'react'
import type { AvailableDevice } from '@/transport/types'
import { UserCancelledError } from '@zmkfirmware/zmk-studio-ts-client/transport/errors'
import type { TransportFactory } from '@/transport/types'
import { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import { Button } from '@/ui/button.tsx'
import { toast } from 'sonner'

interface SimpleDevicePickerProps {
    transports: TransportFactory[]
    onTransportCreated: (
        t: RpcTransport,
        communication: 'serial' | 'ble',
    ) => void
}

export function SimpleDevicePicker({
    transports,
    onTransportCreated,
}: SimpleDevicePickerProps): JSX.Element {
    const [availableDevices, setAvailableDevices] = useState<
        AvailableDevice[] | undefined
    >(undefined)
    const [selectedTransport, setSelectedTransport] = useState<
        TransportFactory | undefined
    >(undefined)
    const ignoreRef = useRef<boolean>(false)

    const connectTransport = useCallback(
        async (transport: TransportFactory): Promise<void> => {
            try {
                const result = await transport.connect?.()

                if (!ignoreRef.current) {
                    if (result) {
                        onTransportCreated(result, transport.communication)
                    }
                }

                setSelectedTransport(undefined)
            } catch (e) {
                if (!ignoreRef.current) {
                    if (
                        e instanceof Error &&
                        !(e instanceof UserCancelledError)
                    ) {
                        console.error(e.message)
                        toast.error(
                            'Failed to connect to the selected device.',
                            {
                                description: e.message,
                            },
                        )
                    }
                }
                setSelectedTransport(undefined)
            }
        },
        [onTransportCreated],
    )

    const loadAvailableDevices = useCallback(
        async (transport: TransportFactory): Promise<void> => {
            const devices = await transport.pick_and_connect?.list()
            console.log(devices)
            if (!ignoreRef.current) {
                setAvailableDevices(devices)
            }
        },
        [],
    )

    useEffect(() => {
        // Reset ignore state at the start of each new connection attempt
        ignoreRef.current = false
        if (!selectedTransport) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAvailableDevices(undefined)
            return
        }

        if (selectedTransport.connect) {
            connectTransport(selectedTransport)
        } else {
            loadAvailableDevices(selectedTransport)
        }

        return (): void => {
            ignoreRef.current = true
        }
    }, [selectedTransport, connectTransport, loadAvailableDevices])

    const connections = transports.map(
        (t): JSX.Element => (
            <li key={t.label} className="list-none">
                <Button
                    type="button"
                    onClick={async (): Promise<void> => setSelectedTransport(t)}
                >
                    {t.label}
                </Button>
            </li>
        ),
    )

    return (
        <div>
            <p className="text-sm">Select a connection type.</p>
            <ul className="flex gap-2 pt-2">{connections}</ul>
            {selectedTransport && availableDevices && (
                <ul>
                    {availableDevices.map((d): JSX.Element => {
                        const handleSelect = async (): Promise<void> => {
                            try {
                                const transport =
                                    await selectedTransport!.pick_and_connect!.connect(
                                        d,
                                    )
                                onTransportCreated(
                                    transport,
                                    selectedTransport!.communication,
                                )
                            } catch (e) {
                                console.log(e)
                                if (
                                    e instanceof Error &&
                                    !(e instanceof UserCancelledError)
                                ) {
                                    toast.error(
                                        'Failed to connect to the selected device.',
                                        { description: e.message },
                                    )
                                }
                            }
                            setSelectedTransport(undefined)
                        }
                        return (
                            <li key={d.id} className="m-1 p-2">
                                <button
                                    type="button"
                                    className="w-full text-left cursor-pointer hover:bg-accent rounded p-1"
                                    onClick={handleSelect}
                                >
                                    {d.label}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
