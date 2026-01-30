import { useCallback, useEffect, useMemo, useState } from "react"
import {
    RefreshCw,
    Keyboard,
    Monitor,
    AlertCircle,
} from "lucide-react"
import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index"
import { UserCancelledError } from "@zmkfirmware/zmk-studio-ts-client/transport/errors"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DeviceCard, DeviceStatus } from "@/components/DeviceCard"
import { TransportFactory } from "@/components/Modals/ConnectModal"
import { TRANSPORTS } from "@/helpers/transports"
import { ExternalLink } from "@/misc/ExternalLink"
import type { AvailableDevice } from "@/tauri"

interface DeviceWithTransport {
    device: AvailableDevice
    transport: TransportFactory
    status: DeviceStatus
}

interface StartPageProps {
    onTransportCreated: (t: RpcTransport, communication: "serial" | "ble") => void
}

export function StartPage({ onTransportCreated }: StartPageProps) {
    const transports = TRANSPORTS
    const haveTransports = useMemo(() => transports.length > 0, [transports])

    const [devices, setDevices] = useState<DeviceWithTransport[]>([])
    const [refreshing, setRefreshing] = useState(false)
    const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null)

    // Check if we have transports that support listing devices
    const hasListableTransports = useMemo(
        () => transports.some(t => t.pick_and_connect),
        [transports]
    )

    // Check if we only have simple connect transports (web browser)
    const hasSimpleConnectOnly = useMemo(
        () => transports.every(t => !t.pick_and_connect && t.connect),
        [transports]
    )

    const loadDevices = useCallback(async () => {
        setRefreshing(true)
        const entries: DeviceWithTransport[] = []

        for (const t of transports.filter(t => t.pick_and_connect)) {
            try {
                const deviceList = await t.pick_and_connect?.list()
                if (deviceList && deviceList.length > 0) {
                    entries.push(
                        ...deviceList.map(d => ({
                            device: d,
                            transport: t,
                            status: "available" as DeviceStatus
                        }))
                    )
                }
            } catch (e) {
                console.error("Failed to list devices for transport:", t.label, e)
            }
        }

        setDevices(entries)
        setRefreshing(false)
    }, [transports])

    useEffect(() => {
        if (hasListableTransports) {
            loadDevices()
        }
    }, [hasListableTransports, loadDevices])

    const handleConnect = useCallback(
        async (deviceWithTransport: DeviceWithTransport) => {
            const { device, transport } = deviceWithTransport
            setConnectingDeviceId(device.id)

            setDevices(prev =>
                prev.map(d =>
                    d.device.id === device.id
                        ? { ...d, status: "connecting" as DeviceStatus }
                        : d
                )
            )

            try {
                const rpcTransport = await transport.pick_and_connect!.connect(device)
                onTransportCreated(rpcTransport, transport.communication)
            } catch (e) {
                console.error("Connection error:", e)
                if (e instanceof Error && !(e instanceof UserCancelledError)) {
                    toast.error("Failed to connect to the selected device.", {
                        description: e.message
                    })
                }
                setDevices(prev =>
                    prev.map(d =>
                        d.device.id === device.id
                            ? { ...d, status: "available" as DeviceStatus }
                            : d
                    )
                )
            } finally {
                setConnectingDeviceId(null)
            }
        },
        [onTransportCreated]
    )

    const handleSimpleConnect = useCallback(
        async (transport: TransportFactory) => {
            try {
                const rpcTransport = await transport.connect?.()
                if (rpcTransport) {
                    onTransportCreated(rpcTransport, transport.communication)
                }
            } catch (e) {
                console.error("Connection error:", e)
                if (e instanceof Error && !(e instanceof UserCancelledError)) {
                    toast.error("Failed to connect to the selected device.", {
                        description: e.message
                    })
                }
            }
        },
        [onTransportCreated]
    )

    const handleRefresh = useCallback(() => {
        setDevices([])
        loadDevices()
    }, [loadDevices])

    if (!haveTransports) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background p-4">
                <Card className="w-full max-w-lg">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                            <AlertCircle className="h-8 w-8 text-destructive" />
                        </div>
                        <CardTitle>Browser Not Supported</CardTitle>
                        <CardDescription>
                            Your browser doesn&apos;t support the required features.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Remappr uses either{" "}
                            <ExternalLink href="https://caniuse.com/web-serial">
                                Web Serial
                            </ExternalLink>{" "}
                            or{" "}
                            <ExternalLink href="https://caniuse.com/web-bluetooth">
                                Web Bluetooth
                            </ExternalLink>{" "}
                            (Linux only) to connect to keyboard devices.
                        </p>
                        <div className="text-sm">
                            <p className="font-medium mb-2">To use Remappr:</p>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                <li>Use a supported browser like Chrome or Edge</li>
                                <li>
                                    Or download our{" "}
                                    <ExternalLink href="/download">
                                        desktop application
                                    </ExternalLink>
                                </li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            {/* Header */}
            <header className="border-b">
                <div className="container mx-auto flex h-16 items-center px-4">
                    <div className="flex items-center gap-2">
                        <Keyboard className="h-6 w-6 text-primary" />
                        <span className="text-xl font-semibold">Remappr</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1">
                <div className="container mx-auto max-w-3xl px-4 py-12">
                    {/* Hero Section */}
                    <div className="mb-12 text-center">
                        <h1 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
                            Configure Your Keyboard
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            Connect your ZMK-powered keyboard to customize keymaps and settings.
                        </p>
                    </div>

                    {/* Device Selection Section */}
                    <Card className="mb-8">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Available Devices</CardTitle>
                                    <CardDescription>
                                        {hasSimpleConnectOnly
                                            ? "Select a connection type to connect your device"
                                            : "Select a device to connect"}
                                    </CardDescription>
                                </div>
                                {hasListableTransports && (
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handleRefresh}
                                        disabled={refreshing}
                                    >
                                        <RefreshCw
                                            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                                        />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {hasSimpleConnectOnly ? (
                                /* Simple Connect Mode (Web Browser) */
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {transports.map(t => (
                                        <Button
                                            key={t.label}
                                            variant="outline"
                                            className="h-auto flex-col gap-2 py-6"
                                            onClick={() => handleSimpleConnect(t)}
                                        >
                                            {t.isWireless ? (
                                                <span className="text-blue-500">Bluetooth</span>
                                            ) : (
                                                <span>USB</span>
                                            )}
                                            <span className="text-sm text-muted-foreground">
                                                Connect via {t.label}
                                            </span>
                                        </Button>
                                    ))}
                                </div>
                            ) : hasListableTransports && devices.length > 0 ? (
                                /* Device List (Tauri App) */
                                <div className="space-y-3">
                                    {devices.map(d => (
                                        <DeviceCard
                                            key={d.device.id}
                                            name={d.device.label}
                                            status={d.status}
                                            isWireless={d.transport.isWireless}
                                            onConnect={() => handleConnect(d)}
                                            disabled={
                                                connectingDeviceId !== null &&
                                                connectingDeviceId !== d.device.id
                                            }
                                        />
                                    ))}
                                </div>
                            ) : hasListableTransports ? (
                                /* Empty State */
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                        <Monitor className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <h3 className="mb-2 font-semibold">No Devices Found</h3>
                                    <p className="mb-4 max-w-sm text-sm text-muted-foreground">
                                        Make sure your keyboard is connected and ZMK Studio is enabled
                                        in your firmware.
                                    </p>
                                    <Button
                                        variant="outline"
                                        onClick={handleRefresh}
                                        disabled={refreshing}
                                    >
                                        <RefreshCw
                                            className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                                        />
                                        Scan for Devices
                                    </Button>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    {/* Demo Mode Section */}
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-8 text-center sm:flex-row sm:justify-between sm:text-left">
                            <div className="mb-4 sm:mb-0">
                                <h3 className="font-semibold">Try Demo Mode</h3>
                                <p className="text-sm text-muted-foreground">
                                    Explore Remappr with a simulated keyboard - no device required.
                                </p>
                            </div>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    toast.info("Demo mode coming soon!", {
                                        description: "This feature is currently under development."
                                    })
                                }}
                            >
                                Try Demo
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t py-6">
                <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
                    <p>
                        Powered by{" "}
                        <ExternalLink href="https://zmk.dev">ZMK Firmware</ExternalLink>
                    </p>
                </div>
            </footer>
        </div>
    )
}
