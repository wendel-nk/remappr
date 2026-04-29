/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react'
import type { AvailableDevice } from '@/transport/types'
import { Key, ListBox, ListBoxItem, Selection } from 'react-aria-components'
import { Bluetooth, RefreshCw } from 'lucide-react'
import type { TransportFactory } from '@/transport/types'
import type { Transport } from '@firmware'
import { UserCancelledError } from '@firmware'
import { ErrorDialog } from '@/components/modals/ErrorDialog'

interface DeviceListProps {
    open?: boolean
    transports: TransportFactory[]
    onTransportCreated: (
        t: Transport,
        communication: 'serial' | 'ble' | 'hid',
    ) => void
}

export function DeviceList({
    open,
    transports,
    onTransportCreated,
}: DeviceListProps): JSX.Element {
    const [devices, setDevices] = useState<
        Array<[TransportFactory, AvailableDevice]>
    >([])
    const [selectedDev, setSelectedDev] = useState(new Set<Key>())
    const [refreshing, setRefreshing] = useState(false)
    const [errorDialog, setErrorDialog] = useState<{
        open: boolean
        title: string
        message: string
        details?: string
    }>({
        open: false,
        title: '',
        message: '',
        details: '',
    })

    const loadDevices = useCallback(
        async (currentTransports: TransportFactory[]): Promise<void> => {
            setRefreshing(true)
            const entries: Array<[TransportFactory, AvailableDevice]> = []

            for (const t of currentTransports.filter(
                (t): boolean => !!t.pick_and_connect,
            )) {
                const devices = await t.pick_and_connect?.list()

                if (!devices || devices.length === 0) {
                    continue
                }
                console.log(devices)
                entries.push(
                    ...devices.map<[TransportFactory, AvailableDevice]>(
                        (d): [TransportFactory, AvailableDevice] => {
                            console.log(t, d)
                            return [t, d]
                        },
                    ),
                )
            }
            console.log(entries)
            setDevices(entries)
            setRefreshing(false)
        },
        [],
    )

    useEffect(() => {
        // Reset and load on mount/deps change
        setSelectedDev(new Set())
        setDevices([])
        loadDevices(transports)
    }, [transports, open, loadDevices])

    const onRefresh = useCallback((): void => {
        setSelectedDev(new Set())
        setDevices([])
        loadDevices(transports)
    }, [loadDevices, transports])

    const onSelect = useCallback(
        async (keys: Selection): Promise<void> => {
            if (keys === 'all') {
                return
            }
            const dev = devices.find(
                ([, d]: [TransportFactory, AvailableDevice]): boolean =>
                    keys.has(d.id),
            )
            if (dev) {
                try {
                    const transport = await dev[0].pick_and_connect!.connect(
                        dev[1],
                    )
                    console.log(keys, dev, transport)
                    onTransportCreated(transport, dev[0].communication)
                } catch (e) {
                    console.error('Connection error:', e)
                    if (
                        e instanceof Error &&
                        !(e instanceof UserCancelledError)
                    ) {
                        // Show custom error dialog instead of browser alert
                        setErrorDialog({
                            open: true,
                            title: 'Connection Error',
                            message:
                                'Failed to connect to the selected device.',
                            details: e.message,
                        })
                    }
                }
            }
        },
        [devices, onTransportCreated],
    )

    return (
        <div>
            <div className="grid grid-cols-[1fr_auto]">
                <span>Select A Device:</span>
                <button
                    className="p-1 rounded hover:bg-accent disabled:bg-background disabled:opacity-75"
                    disabled={refreshing}
                    onClick={onRefresh}
                >
                    <RefreshCw
                        className={`size-5 transition-transform ${refreshing ? 'animate-spin' : ''}`}
                    />
                </button>
            </div>
            <ListBox
                aria-label="Device"
                items={devices}
                onSelectionChange={onSelect}
                selectionMode="single"
                selectedKeys={selectedDev}
                className="flex flex-col gap-1 pt-1"
            >
                {([t, d]: [TransportFactory, AvailableDevice]): JSX.Element => (
                    <ListBoxItem
                        className="grid grid-cols-[1em_1fr] rounded hover:bg-accent cursor-pointer px-1"
                        id={d.id}
                        aria-label={d.label}
                    >
                        {t.isWireless && (
                            <Bluetooth className="w-4 justify-center content-center h-full" />
                        )}
                        <span className="col-start-2">{d.label}</span>
                    </ListBoxItem>
                )}
            </ListBox>

            <ErrorDialog
                open={errorDialog.open}
                onClose={(): void =>
                    setErrorDialog((prev): typeof errorDialog => ({
                        ...prev,
                        open: false,
                    }))
                }
                title={errorDialog.title}
                message={errorDialog.message}
                details={errorDialog.details}
            />
        </div>
    )
}
