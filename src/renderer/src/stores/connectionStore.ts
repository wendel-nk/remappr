// pattern-check: skip mechanical drop-field codemod — removes RpcConnection from store; service is the sole connection handle
import { create, StateCreator } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { KeyboardService } from '@firmware/service'
import type { LockState } from '@firmware/types'

interface ConnectionState {
    service: KeyboardService | null
    communication: 'serial' | 'ble' | null
    deviceName: string | null
    lockState: LockState
    connectionAbort: AbortController
    setService: (
        service: KeyboardService | null,
        communication?: 'serial' | 'ble',
    ) => void
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
                if ('service' in next) {
                    set({ showConnectionModal: next.service === null })
                }
                set(args, replace as false | undefined)
            },
            get,
            api,
        )

const useConnectionStore = create<ConnectionState>()(
    devtools(
        connectionMiddleware((set, get) => ({
            service: null,
            communication: null,
            deviceName: null,
            lockState: 'locked' as LockState,
            connectionAbort: new AbortController(),
            setService: (service, communication) =>
                set({ service, communication: communication ?? null }),
            setDeviceName: (name) => set({ deviceName: name }),
            setLockState: (state) => set({ lockState: state }),
            setConnectionAbort: (abort) => set({ connectionAbort: abort }),
            resetConnection: () =>
                set({
                    service: null,
                    communication: null,
                    deviceName: null,
                    lockState: 'locked' as LockState,
                }),
            showConnectionModal: false,
            setShowConnectionModal: (visible) =>
                set({ showConnectionModal: visible }),
            disconnect: async () => {
                const { service, connectionAbort, resetConnection } = get()
                if (!service) {
                    return
                }

                try {
                    await service.disconnect()
                } catch (error) {
                    console.warn('Failed to disconnect service cleanly', error)
                }

                connectionAbort.abort('User disconnected')
                resetConnection()
                set({ connectionAbort: new AbortController() })
            },
        })),
    ),
)

export default useConnectionStore
