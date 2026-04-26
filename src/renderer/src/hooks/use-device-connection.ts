import { useCallback, useState } from 'react'
import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import { UserCancelledError } from '@zmkfirmware/zmk-studio-ts-client/transport/errors'
import { toast } from 'sonner'
import type { TransportFactory } from '@/transport/types'
import type { DeviceStatus } from '@/features/connection/DeviceCard'
import type { DeviceWithTransport } from '@/hooks/use-transport-discovery'

interface UseDeviceConnectionResult {
    connectingDeviceId: string | null
    handleConnect: (d: DeviceWithTransport) => Promise<void>
    handleSimpleConnect: (t: TransportFactory) => Promise<void>
}

export function useDeviceConnection(
    onTransportCreated: (
        t: RpcTransport,
        communication: 'serial' | 'ble',
    ) => void,
    setDevices: React.Dispatch<React.SetStateAction<DeviceWithTransport[]>>,
): UseDeviceConnectionResult {
    const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(
        null,
    )

    const handleConnect = useCallback(
        async (deviceWithTransport: DeviceWithTransport): Promise<void> => {
            const { device, transport } = deviceWithTransport
            setConnectingDeviceId(device.id)

            setDevices((prev): DeviceWithTransport[] =>
                prev.map(
                    (d): DeviceWithTransport =>
                        d.device.id === device.id
                            ? { ...d, status: 'connecting' as DeviceStatus }
                            : d,
                ),
            )

            try {
                const rpcTransport =
                    await transport.pick_and_connect!.connect(device)
                onTransportCreated(rpcTransport, transport.communication)
            } catch (e) {
                console.error('Connection error:', e)
                if (e instanceof Error && !(e instanceof UserCancelledError)) {
                    toast.error('Failed to connect to the selected device.', {
                        description: e.message,
                    })
                }
                setDevices((prev): DeviceWithTransport[] =>
                    prev.map(
                        (d): DeviceWithTransport =>
                            d.device.id === device.id
                                ? { ...d, status: 'available' as DeviceStatus }
                                : d,
                    ),
                )
            } finally {
                setConnectingDeviceId(null)
            }
        },
        [onTransportCreated, setDevices],
    )

    const handleSimpleConnect = useCallback(
        async (transport: TransportFactory): Promise<void> => {
            try {
                const rpcTransport = await transport.connect?.()
                if (rpcTransport) {
                    onTransportCreated(rpcTransport, transport.communication)
                }
            } catch (e) {
                console.error('Connection error:', e)
                if (e instanceof Error && !(e instanceof UserCancelledError)) {
                    toast.error('Failed to connect to the selected device.', {
                        description: e.message,
                    })
                }
            }
        },
        [onTransportCreated],
    )

    return { connectingDeviceId, handleConnect, handleSimpleConnect }
}
