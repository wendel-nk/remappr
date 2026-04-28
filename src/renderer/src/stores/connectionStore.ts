// pattern-check: skip add-field codemod — extends ConnectionState with neutral KeyboardService alongside RpcConnection
import { create, StateCreator } from 'zustand'
import { devtools } from 'zustand/middleware'
import { RpcConnection } from '@zmkfirmware/zmk-studio-ts-client'
import type { KeyboardService } from '@firmware/service'
import type { LockState } from '@firmware/types'

interface ConnectionState {
    connection: RpcConnection | null
    service: KeyboardService | null
    communication: 'serial' | 'ble' | null
    deviceName: string | null
    lockState: LockState
    connectionAbort: AbortController
    setConnection: (
        connection: RpcConnection | null,
        communication?: 'serial' | 'ble',
    ) => void
    setService: (service: KeyboardService | null) => void
    setDeviceName: (name: string | null) => void
    setLockState: (state: LockState) => void
    setConnectionAbort: (abort: AbortController) => void
    resetConnection: () => void
    showConnectionModal: boolean
    setShowConnectionModal: (visible: boolean) => void
    disconnect: () => Promise<void>
}

const connectionMiddleware =
    (config: StateCreator<ConnectionState>): StateCreator<ConnectionState> =>
    (set, get, api) =>
        config(
            (args, replace) => {
                const next = args as Partial<ConnectionState>
                if ('connection' in next) {
                    set({ showConnectionModal: next.connection === null })
                }
                set(args, replace as false | undefined)
            },
            get,
            api,
        )

const useConnectionStore = create<ConnectionState>()(
    devtools(
        connectionMiddleware((set, get) => ({
            connection: null,
            service: null,
            communication: null,
            deviceName: null,
            lockState: 'locked' as LockState,
            connectionAbort: new AbortController(),
            setConnection: (connection, communication) =>
                set({ connection, communication: communication ?? null }),
            setService: (service) => set({ service }),
            setDeviceName: (name) => set({ deviceName: name }),
            setLockState: (state) => set({ lockState: state }),
            setConnectionAbort: (abort) => set({ connectionAbort: abort }),
            resetConnection: () =>
                set({
                    connection: null,
                    service: null,
                    communication: null,
                    deviceName: null,
                    lockState: 'locked' as LockState,
                }),
            showConnectionModal: false,
            setShowConnectionModal: (visible) =>
                set({ showConnectionModal: visible }),
            disconnect: async () => {
                const {
                    connection,
                    service,
                    connectionAbort,
                    resetConnection,
                } = get()
                if (!connection && !service) {
                    return
                }

                if (service) {
                    try {
                        await service.disconnect()
                    } catch (error) {
                        console.warn(
                            'Failed to disconnect service cleanly',
                            error,
                        )
                    }
                } else if (connection) {
                    try {
                        await connection.request_writable.close()
                    } catch (error) {
                        console.warn(
                            'Failed to close connection cleanly',
                            error,
                        )
                    }
                }

                connectionAbort.abort('User disconnected')
                resetConnection()
                set({ connectionAbort: new AbortController() })
            },
        })),
    ),
)

export default useConnectionStore
