import React, { JSX, useCallback, useEffect } from 'react'
import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import { useEmitter } from '@/hooks/use-pub-sub'
import { LockState } from '@zmkfirmware/zmk-studio-ts-client/core'
import { UnlockModal } from '@/features/connection/UnlockModal'
import { connect } from '@/features/connection/rpcConnectionService'
import useConnectionStore from '@/stores/connectionStore'
import undoRedoStore from '@/stores/undoRedoStore'
import { KeyboardEditor } from '@/features/keymap/KeyboardEditor'
import { Drawer } from '@/layout/Drawer.tsx'
import { SidebarInset, SidebarProvider } from '@/ui/sidebar.tsx'
import { ThemeProvider } from '@/providers/ThemeProvider.tsx'
import { Toaster } from '@/ui/sonner.tsx'
import { Header } from '@/layout/Header.tsx'
// import { Footer } from '@/layout/Footer.tsx'
import { ErrorBoundary } from '@/ui/ErrorBoundary.tsx'
import { toast } from 'sonner'
import { callRemoteProcedureControl } from '@/features/connection/callRemoteProcedureControl.ts'
import { StartPage } from '@/features/connection/StartPage'

function App(): JSX.Element {
    const {
        connection,
        setConnection,
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
                setLockState(data as LockState)
            },
        )
    }, [subscribe, setLockState])

    const updateLockState = useCallback(async (): Promise<void> => {
        if (!connection) return

        const locked_resp = await callRemoteProcedureControl({
            core: { getLockState: true },
        })
        setLockState(
            locked_resp.core?.getLockState ||
                LockState.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED,
        )
    }, [connection, setLockState])

    useEffect(() => {
        if (!connection) {
            reset()
            setLockState(LockState.ZMK_STUDIO_CORE_LOCK_STATE_LOCKED)
        }

        updateLockState()
    }, [connection, setLockState, reset, updateLockState])

    const onConnect = async (
        t: RpcTransport,
        communication: 'serial' | 'ble',
    ): Promise<void> => {
        const connection = await connect(
            t,
            setConnection,
            setDeviceName,
            connectionAbort.signal,
            communication,
        )
        if (typeof connection === 'string') {
            toast.error('Failed to connect to the selected device.', {
                description: connection,
            })
        }
    }

    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            {connection ? (
                <ErrorBoundary>
                    <UnlockModal />
                    <SidebarProvider
                        style={
                            {
                                '--sidebar-width': 'calc(var(--spacing) * 72)',
                                '--header-height': 'calc(var(--spacing) * 12)',
                                '--footer-height': 'calc(var(--spacing) * 8)',
                            } as React.CSSProperties
                        }
                    >
                        <Drawer />
                        <SidebarInset>
                            <Header />
                            <ErrorBoundary>
                                <KeyboardEditor />
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
            <Toaster richColors position="top-center" />
        </ThemeProvider>
    )
}

export default App
