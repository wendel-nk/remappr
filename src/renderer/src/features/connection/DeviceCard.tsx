import { useRef, useState } from 'react'
import {
    Bluetooth,
    Usb,
    Loader2,
    SignalHigh,
    Pencil,
    Check,
    X,
} from 'lucide-react'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { cn } from '@/lib/cn'

export type DeviceStatus = 'available' | 'connecting' | 'connected'

export interface DeviceCardProps {
    name: string
    status: DeviceStatus
    isWireless?: boolean
    onConnect: () => void
    onDisconnect?: () => void
    disabled?: boolean
    canRename?: boolean
    onRename?: (newName: string) => void
}

function StatusBadge({ status }: { status: DeviceStatus }): JSX.Element {
    const statusConfig = {
        available: {
            bgColor: 'bg-emerald-500/15',
            textColor: 'text-emerald-500',
            dotColor: 'bg-emerald-500',
            pulse: false,
            label: 'Ready',
        },
        connecting: {
            bgColor: 'bg-amber-500/15',
            textColor: 'text-amber-500',
            dotColor: 'bg-amber-500',
            pulse: true,
            label: 'Connecting',
        },
        connected: {
            bgColor: 'bg-primary/15',
            textColor: 'text-primary',
            dotColor: 'bg-primary',
            pulse: false,
            label: 'Connected',
        },
    }

    const config = statusConfig[status]

    return (
        <div
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5',
                config.bgColor,
            )}
        >
            <span
                className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    config.dotColor,
                    config.pulse && 'animate-pulse',
                )}
            />
            <span className={cn('text-xs font-medium', config.textColor)}>
                {config.label}
            </span>
        </div>
    )
}

export function DeviceCard({
    name,
    status,
    isWireless = false,
    onConnect,
    onDisconnect,
    disabled = false,
    canRename = false,
    onRename,
}: DeviceCardProps): JSX.Element {
    const isConnecting = status === 'connecting'
    const isConnected = status === 'connected'

    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(name)
    const inputRef = useRef<HTMLInputElement>(null)

    const startEdit = (): void => {
        setDraft(name)
        setEditing(true)
        queueMicrotask(() => inputRef.current?.select())
    }
    const commit = (): void => {
        const next = draft.trim()
        if (next && next !== name && onRename) onRename(next)
        setEditing(false)
    }
    const cancel = (): void => {
        setDraft(name)
        setEditing(false)
    }

    return (
        <div
            className={cn(
                'group relative overflow-hidden rounded-xl border bg-card p-4 transition-all duration-300',
                'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5',
                isConnected && 'border-primary/50 bg-primary/5',
                isConnecting && 'border-amber-500/50',
                disabled && 'opacity-50 pointer-events-none',
            )}
        >
            {/* Subtle gradient overlay on hover */}
            <div
                className={cn(
                    'absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300',
                    'group-hover:opacity-100',
                    isConnected && 'opacity-100',
                )}
            />

            <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    {/* Connection type icon */}
                    <div
                        className={cn(
                            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors duration-300',
                            isWireless
                                ? 'bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20'
                                : 'bg-muted text-muted-foreground group-hover:bg-muted/80',
                            isConnected &&
                                (isWireless
                                    ? 'bg-blue-500/20'
                                    : 'bg-primary/10 text-primary'),
                        )}
                    >
                        {isWireless ? (
                            <Bluetooth className="h-6 w-6" />
                        ) : (
                            <Usb className="h-6 w-6" />
                        )}
                    </div>

                    {/* Device info */}
                    <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                            {editing ? (
                                <>
                                    <Input
                                        ref={inputRef}
                                        value={draft}
                                        onChange={(e) =>
                                            setDraft(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') commit()
                                            else if (e.key === 'Escape')
                                                cancel()
                                        }}
                                        className="h-7 text-sm"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 shrink-0"
                                        onClick={commit}
                                        aria-label="Save name"
                                    >
                                        <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 shrink-0"
                                        onClick={cancel}
                                        aria-label="Cancel rename"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <p className="font-semibold truncate text-foreground">
                                        {name}
                                    </p>
                                    {canRename && onRename && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100"
                                            onClick={startEdit}
                                            aria-label="Rename device"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                    {isWireless && (
                                        <SignalHigh className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    )}
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <StatusBadge status={status} />
                            <span className="text-xs text-muted-foreground">
                                {isWireless ? 'Bluetooth' : 'USB'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Action button */}
                <div className="shrink-0">
                    {isConnected ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onDisconnect}
                            className="border-primary/30 hover:border-primary hover:bg-primary/10"
                        >
                            Disconnect
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            onClick={onConnect}
                            disabled={isConnecting}
                            className={cn(
                                'min-w-[100px]',
                                !isConnecting &&
                                    'shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30',
                            )}
                        >
                            {isConnecting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Connecting</span>
                                </>
                            ) : (
                                'Connect'
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
