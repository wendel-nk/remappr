import React, { JSX, useCallback, useEffect } from 'react'
import { connectMock, isUnlocked, pickAdapter } from '@firmware'
import type { Transport } from '@firmware'
import { rememberConnectedDeviceName } from '@/transport/web-serial'
import { LockedOverlay } from '@/features/connection/LockedOverlay'
import useConnectionStore from '@/stores/connectionStore'
import useUserSettingsStore from '@/stores/userSettingsStore'
import undoRedoStore from '@/stores/undoRedoStore'
import { KeymapEditor } from '@/features/keymap/editor/KeymapEditor'
import { Drawer } from '@/layout/Drawer'
import { SidebarInset, SidebarProvider } from '@/ui/sidebar'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { Toaster } from '@/ui/sonner'
import { Header } from '@/layout/Header'
import { AutoLayoutResolver } from '@/features/firmware/AutoLayoutResolver'
import { DevicePreviewCapture } from '@/features/connection/DevicePreviewCapture'
// import { Footer } from '@/layout/Footer'
import { ErrorBoundary } from '@/ui/ErrorBoundary'
import { toast } from 'sonner'
import { StartPage } from '@/features/connection/start-page/StartPage'
import { CoachmarkTour } from '@/features/onboarding/CoachmarkTour'
import { UpdateNotification } from '@/components/UpdateNotification'
import { TitleBar } from '@/layout/TitleBar'
import { isElectron as isElectronEnv } from '@/transport'
import { useConfigRuntimeSync } from '@/hooks/use-config-runtime-sync'

function App(): JSX.Element {
    // pattern-check: skip — UI sweep, replace store-connection with store-service
    const {
        service,
        setService,
        setDeviceName,
        setLockState,
        connectionAbort,
        lockState,
    } = useConnectionStore()
    const { reset } = undoRedoStore()

    // Raise visual-editor edits back into the config (source of truth) so the
    // download modal compiles what the user sees. Mock/demo only.
    useConfigRuntimeSync()

    const updateLockState = useCallback(async (): Promise<void> => {
        if (!service) return
        const next = await service.getLockState()
        setLockState(next)
    }, [service, setLockState])

    useEffect(() => {
        if (!service) {
            reset()
            setLockState('locked')
            return
        }
        updateLockState()
        return service.onLockStateChanged(setLockState)
    }, [service, setLockState, reset, updateLockState])

    const setPreferredAdapterCategory = useUserSettingsStore(
        (s) => s.setPreferredAdapterCategory,
    )
    useEffect(() => {
        if (!service) {
            setPreferredAdapterCategory('zmk')
            return
        }
        const fw = service.deviceInfo.firmware
        setPreferredAdapterCategory(fw === 'zmk' ? 'zmk' : 'qmk')
    }, [service, setPreferredAdapterCategory])

    const onConnect = async (
        t: Transport,
        communication: 'serial' | 'ble' | 'hid',
    ): Promise<void> => {
        const adapter = await pickAdapter(t, { transportKind: communication })
        if (!adapter) {
            toast.error('Failed to connect to the selected device.', {
                description: 'No firmware adapter handled the device.',
            })
            return
        }
        try {
            const next = await adapter.connect(t, connectionAbort.signal)
            next.onClosed((): void => {
                setDeviceName(null)
                setService(null)
            })
            setDeviceName(next.deviceInfo.name)
            if (communication === 'serial') {
                rememberConnectedDeviceName(next.deviceInfo.name)
            }
            setService(next, communication)
        } catch (err) {
            toast.error('Failed to connect to the selected device.', {
                description: err instanceof Error ? err.message : String(err),
            })
        }
    }

    const onDemoConnect = async (): Promise<void> => {
        try {
            const next = await connectMock()
            next.onClosed((): void => {
                setDeviceName(null)
                setService(null)
            })
            setDeviceName(next.deviceInfo.name)
            setService(next)
        } catch (err) {
            toast.error('Failed to start demo mode.', {
                description: err instanceof Error ? err.message : String(err),
            })
        }
    }

    const isElectron = isElectronEnv()

    useEffect(() => {
        if (!isElectron) return
        document.body.classList.add('app-electron')
        return () => document.body.classList.remove('app-electron')
    }, [isElectron])

    const showEditor =
        !!service && !(service.capabilities.lock && !isUnlocked(lockState))

    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <div className="flex h-screen flex-col overflow-hidden">
                {/* In the editor the window controls are merged into the 52px header;
                    elsewhere (start page / locked overlay) we still need a drag bar. */}
                {!showEditor && <TitleBar />}
                <div className="flex-1 min-h-0 overflow-hidden">
                    {service ? (
                        service.capabilities.lock && !isUnlocked(lockState) ? (
                            <ErrorBoundary>
                                <LockedOverlay />
                            </ErrorBoundary>
                        ) : (
                            <ErrorBoundary>
                                <SidebarProvider
                                    className="!min-h-0 h-full"
                                    style={
                                        {
                                            '--sidebar-width': '15.5rem',
                                            '--header-height':
                                                'calc(var(--spacing) * 13)',
                                            '--footer-height':
                                                'calc(var(--spacing) * 8)',
                                        } as React.CSSProperties
                                    }
                                >
                                    <Drawer />
                                    <SidebarInset>
                                        <Header />
                                        <AutoLayoutResolver />
                                        <DevicePreviewCapture />
                                        <ErrorBoundary>
                                            <KeymapEditor />
                                        </ErrorBoundary>
                                        {/*<Footer />*/}
                                    </SidebarInset>
                                    <CoachmarkTour />
                                </SidebarProvider>
                            </ErrorBoundary>
                        )
                    ) : (
                        <ErrorBoundary>
                            <StartPage
                                onTransportCreated={onConnect}
                                onDemoConnect={onDemoConnect}
                            />
                        </ErrorBoundary>
                    )}
                </div>
            </div>
            <UpdateNotification />
            <Toaster richColors position="top-center" />
        </ThemeProvider>
    )
}

export default App
