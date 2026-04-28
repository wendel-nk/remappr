import React, { JSX, useCallback, useEffect } from 'react'
import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import { useEmitter } from '@/hooks/use-pub-sub'
import type { LockState } from '@firmware/types'

const mapZmkLockState = (raw: unknown): LockState =>
    raw === 1 || raw === 'unlocked' ? 'unlocked' : 'locked'
import { UnlockModal } from '@/features/connection/UnlockModal'
import { connectDevice } from '@firmware/zmk/rpc/rpcConnect'
import useConnectionStore from '@/stores/connectionStore'
import undoRedoStore from '@/stores/undoRedoStore'
import { KeymapEditor } from '@/features/keymap/editor/KeymapEditor'
import { Drawer } from '@/layout/Drawer'
import { SidebarInset, SidebarProvider } from '@/ui/sidebar'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { Toaster } from '@/ui/sonner'
import { Header } from '@/layout/Header'
// import { Footer } from '@/layout/Footer'
import { ErrorBoundary } from '@/ui/ErrorBoundary'
import { toast } from 'sonner'
import { StartPage } from '@/features/connection/start-page/StartPage'
import { UpdateNotification } from '@/components/UpdateNotification'
import { TitleBar } from '@/layout/TitleBar'

function App(): JSX.Element {
    // pattern-check: skip — UI sweep, replace store-connection with store-service
    const {
        service,
        setService,
        setDeviceName,
        setLockState,
        connectionAbort,
    } = useConnectionStore()
    const { reset } = undoRedoStore()
    const { subscribe } = useEmitter()

    useEffect(() => {
        return subscribe(
            'rpc_notification.core.lockStateChanged',
            (data: unknown): void => {
                setLockState(mapZmkLockState(data))
            },
        )
    }, [subscribe, setLockState])

    const updateLockState = useCallback(async (): Promise<void> => {
        if (!service) return
        const next = await service.getLockState()
        setLockState(next)
    }, [service, setLockState])

    useEffect(() => {
        if (!service) {
            reset()
            setLockState('locked')
        }

        updateLockState()
    }, [service, setLockState, reset, updateLockState])

    const onConnect = async (
        t: RpcTransport,
        communication: 'serial' | 'ble',
    ): Promise<void> => {
        const connectResult = await connectDevice(
            t,
            setService,
            setDeviceName,
            connectionAbort.signal,
            communication,
        )
        if (typeof connectResult === 'string') {
            toast.error('Failed to connect to the selected device.', {
                description: connectResult,
            })
        }
    }

    const isElectron =
        typeof window !== 'undefined' &&
        Boolean((window as unknown as { api?: unknown }).api)

    useEffect(() => {
        if (!isElectron) return
        document.body.classList.add('app-electron')
        return () => document.body.classList.remove('app-electron')
    }, [isElectron])

    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <div className="flex h-screen flex-col overflow-hidden">
                <TitleBar />
                <div className="flex-1 min-h-0 overflow-hidden">
                    {service ? (
                        <ErrorBoundary>
                            <UnlockModal />
                            <SidebarProvider
                                className="!min-h-0 h-full"
                                style={
                                    {
                                        '--sidebar-width':
                                            'calc(var(--spacing) * 72)',
                                        '--header-height':
                                            'calc(var(--spacing) * 12)',
                                        '--footer-height':
                                            'calc(var(--spacing) * 8)',
                                    } as React.CSSProperties
                                }
                            >
                                <Drawer />
                                <SidebarInset>
                                    <Header />
                                    <ErrorBoundary>
                                        <KeymapEditor />
                                    </ErrorBoundary>
                                    {/*<Footer />*/}
                                </SidebarInset>
                            </SidebarProvider>
                        </ErrorBoundary>
                    ) : (
                        <ErrorBoundary>
                            <StartPage onTransportCreated={onConnect} />
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
