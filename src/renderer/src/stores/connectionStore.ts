// pattern-check: skip mechanical drop-field codemod — removes RpcConnection from store; service is the sole connection handle
// Pattern check: no GoF pattern (-) — rejected — additive zustand store slice for keyCatalog; existing store already exists, no abstraction needed.
import { create, StateCreator } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { KeyCatalog } from '@firmware/catalog/types'
import type { KeyboardService } from '@firmware/service'
import type { LockState } from '@firmware/types'
import useDynamicCatalogStore from '@/stores/dynamicCatalogStore'
import useConfigStore from '@/stores/configStore'
import useLayerSelectionStore from '@/stores/layerSelectionStore'
import useKeymapStore from '@/stores/keymapStore'
import useLightingCatalogStore from '@/stores/lightingCatalogStore'
import { createOsBackedKeyTest } from '@/features/keymap/keyboard/stage/osBackedKeyTest'
import { cacheKey, loadCached } from '@firmware/qmk/layoutSideload'
import { parseLightingMenu } from '@firmware/via/lightingMenu'

// Teardown for the connected keyboard's default-layer subscription (Feature 1).
// Module-scoped: the store is a singleton, and this keeps the internal handle off
// the public ConnectionState surface.
let defaultLayerUnsub: (() => void) | null = null

interface ConnectionState {
    service: KeyboardService | null
    communication: 'serial' | 'ble' | 'hid' | null
    deviceName: string | null
    lockState: LockState
    keyCatalog: KeyCatalog | null
    connectionAbort: AbortController
    /** Identity of the listed device being connected — bridges connect → preview capture. */
    lastConnectedDevice: { id: string; label: string } | null
    setService: (
        service: KeyboardService | null,
        communication?: 'serial' | 'ble' | 'hid',
    ) => void
    setLastConnectedDevice: (
        device: { id: string; label: string } | null,
    ) => void
    setDeviceName: (name: string | null) => void
    setLockState: (state: LockState) => void
    setKeyCatalog: (catalog: KeyCatalog | null) => void
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
            keyCatalog: null,
            connectionAbort: new AbortController(),
            lastConnectedDevice: null,
            setService: (service, communication) => {
                // The deviceless mock has no switch matrix, so give it an
                // OS-event-backed keyTest facade — Key Test then works in demo
                // through the same path real hardware would, and the Header gate
                // (service.keyTest) shows the button only here, not on firmwares
                // that lack a matrix channel.
                if (
                    service &&
                    service.deviceInfo.firmware === 'mock' &&
                    !service.keyTest
                ) {
                    service.keyTest = createOsBackedKeyTest(() => {
                        const keymap = useKeymapStore.getState().keymap
                        if (!keymap) return null
                        return {
                            layouts: keymap.layouts,
                            keymap,
                            selectedLayerIndex:
                                useLayerSelectionStore.getState()
                                    .selectedLayerIndex,
                            selectedPhysicalLayoutIndex: keymap.activeLayoutId,
                        }
                    })
                }
                set({ service, communication: communication ?? null })
                // Guard against stale async writes: if the user disconnects or
                // connects a different device before any of the awaited reads
                // below resolve, the resolved value belongs to the PREVIOUS
                // service and must not overwrite the current store (e.g. the old
                // device's keyCatalog/config clobbering the new one, or undoing a
                // reset). Every async callback re-checks the live service first.
                const isCurrent = (): boolean => get().service === service
                // Diagnostics: which adapter connected + which facades attached.
                if (service)
                    console.info('[connect] service', {
                        firmware: service.deviceInfo.firmware,
                        firmwareVersion: service.deviceInfo.firmwareVersion,
                        rgb: !!service.rgb,
                        wireless: !!service.wireless,
                        advanced: !!service.advanced,
                        layerControl: !!service.layerControl,
                    })
                // Feature 1: auto-select the keyboard's hardware default layer
                // (e.g. Keychron Mac/Win DIP) and follow live toggles. Adapters
                // without a `layers` facade leave the editor's selection alone.
                defaultLayerUnsub?.()
                defaultLayerUnsub = null
                // Seed the RGB effect list from a previously imported/cached board
                // definition's lighting menu (real per-board effect names).
                useLightingCatalogStore.getState().setCatalog(null)
                if (service) {
                    try {
                        const k = cacheKey(service.deviceInfo)
                        const def = k ? loadCached(k) : null
                        if (def)
                            useLightingCatalogStore
                                .getState()
                                .setCatalog(parseLightingMenu(def.raw.menus))
                    } catch (err) {
                        console.warn('lighting-menu seed failed', err)
                    }
                }
                if (service?.layerControl) {
                    const setLayer =
                        useLayerSelectionStore.getState().setSelectedLayerIndex
                    service.layerControl
                        .getDefaultLayer()
                        .then((n) => {
                            if (isCurrent()) setLayer(n)
                        })
                        .catch((err) =>
                            console.warn('getDefaultLayer failed', err),
                        )
                    defaultLayerUnsub =
                        service.layerControl.onDefaultLayerChanged(setLayer)
                }
                if (service?.listKeyCatalog) {
                    service
                        .listKeyCatalog()
                        .then((catalog) => {
                            if (isCurrent()) set({ keyCatalog: catalog })
                        })
                        .catch((err) => {
                            console.warn('listKeyCatalog failed', err)
                            if (isCurrent()) set({ keyCatalog: null })
                        })
                } else {
                    set({ keyCatalog: null })
                }
                useDynamicCatalogStore
                    .getState()
                    .refresh(service)
                    .catch((err) =>
                        console.warn('dynamicCatalog refresh failed', err),
                    )
                // Seed the config source-of-truth from the device, if it ships one.
                if (service?.getConfigSource) {
                    service
                        .getConfigSource()
                        .then((src) => {
                            if (!isCurrent()) return
                            if (src)
                                useConfigStore.getState().loadFromSource(src)
                            else useConfigStore.getState().reset()
                        })
                        .catch((err) => {
                            console.warn('getConfigSource failed', err)
                            if (isCurrent()) useConfigStore.getState().reset()
                        })
                } else {
                    useConfigStore.getState().reset()
                }
            },
            setLastConnectedDevice: (device) =>
                set({ lastConnectedDevice: device }),
            setDeviceName: (name) => set({ deviceName: name }),
            setLockState: (state) => set({ lockState: state }),
            setKeyCatalog: (catalog) => set({ keyCatalog: catalog }),
            setConnectionAbort: (abort) => set({ connectionAbort: abort }),
            resetConnection: () => {
                defaultLayerUnsub?.()
                defaultLayerUnsub = null
                useLightingCatalogStore.getState().setCatalog(null)
                set({
                    service: null,
                    communication: null,
                    deviceName: null,
                    lockState: 'locked' as LockState,
                    keyCatalog: null,
                    // Clear the connect→preview-capture bridge so a stale id from
                    // the prior device can't key the next session's snapshot
                    // (e.g. demo mode overwriting a real keyboard's preview).
                    lastConnectedDevice: null,
                })
                useDynamicCatalogStore.getState().reset()
                useConfigStore.getState().reset()
            },
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
