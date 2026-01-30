import { Bluetooth, Usb, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type DeviceStatus = "available" | "connecting" | "connected"

export interface DeviceCardProps {
    name: string
    status: DeviceStatus
    isWireless?: boolean
    onConnect: () => void
    onDisconnect?: () => void
    disabled?: boolean
}

function StatusIndicator({ status }: { status: DeviceStatus }) {
    const statusConfig = {
        available: {
            color: "bg-emerald-500",
            pulse: false,
            label: "Available"
        },
        connecting: {
            color: "bg-amber-500",
            pulse: true,
            label: "Connecting"
        },
        connected: {
            color: "bg-blue-500",
            pulse: false,
            label: "Connected"
        }
    }

    const config = statusConfig[status]

    return (
        <div className="flex items-center gap-2">
            <span
                className={cn(
                    "inline-block h-2 w-2 rounded-full",
                    config.color,
                    config.pulse && "animate-pulse"
                )}
            />
            <span className="text-xs text-muted-foreground">{config.label}</span>
        </div>
    )
}

export function DeviceCard({
    name,
    status,
    isWireless = false,
    onConnect,
    onDisconnect,
    disabled = false
}: DeviceCardProps) {
    const isConnecting = status === "connecting"
    const isConnected = status === "connected"

    return (
        <Card
            className={cn(
                "transition-all duration-200 hover:shadow-md",
                isConnected && "ring-2 ring-primary/50",
                disabled && "opacity-50 pointer-events-none"
            )}
        >
            <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                            isWireless ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground"
                        )}>
                            {isWireless ? (
                                <Bluetooth className="h-5 w-5" />
                            ) : (
                                <Usb className="h-5 w-5" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="font-medium truncate">{name}</p>
                            <StatusIndicator status={status} />
                        </div>
                    </div>
                    <div className="shrink-0">
                        {isConnected ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onDisconnect}
                            >
                                Disconnect
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={onConnect}
                                disabled={isConnecting}
                            >
                                {isConnecting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Connecting
                                    </>
                                ) : (
                                    "Connect"
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
