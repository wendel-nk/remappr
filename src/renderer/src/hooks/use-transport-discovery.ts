import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TransportFactory, AvailableDevice } from '@/transport/types'
import type { DeviceStatus } from '@/features/connection/DeviceCard'
import { getTransports, isElectron } from '@/lib/transports'
import { onDevicesChanged as onSerialDevicesChanged } from '@/electron/serial'

export interface DeviceWithTransport {
    device: AvailableDevice
    transport: TransportFactory
    status: DeviceStatus
}

interface UseTransportDiscoveryResult {
    transports: TransportFactory[]
    haveTransports: boolean
    hasListableTransports: boolean
    hasSimpleConnectOnly: boolean
    refreshing: boolean
    refresh: () => void
}

export function useTransportDiscovery(
    setDevices: React.Dispatch<React.SetStateAction<DeviceWithTransport[]>>,
    connectingDeviceId: string | null,
): UseTransportDiscoveryResult {
    const transports = useMemo(() => getTransports(), [])
    const haveTransports = useMemo(
        (): boolean => transports.length > 0,
        [transports],
    )

    const [refreshing, setRefreshing] = useState(false)

    const hasListableTransports = useMemo(
        (): boolean => transports.some((t): boolean => !!t.pick_and_connect),
        [transports],
    )

    const hasSimpleConnectOnly = useMemo(
        (): boolean =>
            transports.every(
                (t): boolean => !t.pick_and_connect && !!t.connect,
            ),
        [transports],
    )

    const loadDevices = useCallback(async (): Promise<void> => {
        setRefreshing(true)
        const listable = transports.filter((t): boolean => !!t.pick_and_connect)

        const results = await Promise.all(
            listable.map(async (t) => {
                try {
                    const deviceList = await t.pick_and_connect?.list()
                    return (deviceList ?? []).map(
                        (d): DeviceWithTransport => ({
                            device: d,
                            transport: t,
                            status: 'available' as DeviceStatus,
                        }),
                    )
                } catch (e) {
                    console.error(
                        'Failed to list devices for transport:',
                        t.label,
                        e,
                    )
                    return []
                }
            }),
        )

        setDevices(results.flat())
        setRefreshing(false)
    }, [transports, setDevices])

    useEffect(() => {
        if (hasListableTransports) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            loadDevices()
        }
    }, [hasListableTransports, loadDevices])

    useEffect(() => {
        if (!isElectron() || !hasListableTransports) return
        return onSerialDevicesChanged(() => {
            if (connectingDeviceId === null) loadDevices()
        })
    }, [hasListableTransports, loadDevices, connectingDeviceId])

    const refresh = useCallback((): void => {
        setDevices([])
        loadDevices()
    }, [loadDevices, setDevices])

    return {
        transports,
        haveTransports,
        hasListableTransports,
        hasSimpleConnectOnly,
        refreshing,
        refresh,
    }
}
