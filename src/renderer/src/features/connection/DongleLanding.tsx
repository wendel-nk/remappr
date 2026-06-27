// Pattern check: no GoF pattern (-) — rejected — a React functional view listing
// the dongle's node roster; UI composition over the connection store, no GoF
// abstraction warranted.
//
// Where a host lands after connecting to a ROLE_DONGLE device: the dongle has no
// keymap of its own, so instead of the editor we show its bonded node roster.
// Clicking an online node opens a (read-only) view of it via the store's
// openNode, which swaps the active service to the relayed node.
import { JSX, useCallback, useEffect, useState } from 'react'
import { Cpu, Power, Radio, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import useConnectionStore from '@/stores/connectionStore'
import { Button } from '@/ui/button'
import type { NodeView } from '@firmware/service'

export function DongleLanding(): JSX.Element {
    const { service, communication, openNode, disconnect } =
        useConnectionStore()
    const [nodes, setNodes] = useState<NodeView[]>([])
    const [loading, setLoading] = useState(true)

    const nodesApi = service?.nodes

    // All setState happens AFTER the await (never synchronously in the effect
    // body), so the initial load and a manual refresh share one path. `loading`
    // starts true; the refresh button flips it back on before re-fetching.
    const fetchNodes = useCallback(async (): Promise<void> => {
        if (!nodesApi) return
        try {
            setNodes(await nodesApi.list())
        } catch (e) {
            console.warn('Failed to list nodes', e)
            toast.error('Failed to list nodes', {
                description: e instanceof Error ? e.message : String(e),
            })
            setNodes([])
        } finally {
            setLoading(false)
        }
    }, [nodesApi])

    useEffect(() => {
        // One-shot roster fetch on mount; setState lands after the await. Matches
        // the codebase's async-load-in-effect idiom (see AutoLayoutResolver).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchNodes()
    }, [fetchNodes])

    const refresh = useCallback((): void => {
        setLoading(true)
        void fetchNodes()
    }, [fetchNodes])

    const handleOpen = useCallback(
        async (id: number): Promise<void> => {
            try {
                await openNode(id)
            } catch (e) {
                toast.error('Failed to open node', {
                    description: e instanceof Error ? e.message : String(e),
                })
            }
        },
        [openNode],
    )

    const dongleName = service?.deviceInfo.name?.trim() || 'Remappr Dongle'
    const connLabel = communication === 'ble' ? 'BLE' : 'USB'

    return (
        <div className="flex h-full flex-col overflow-hidden">
            {/* Identity + actions. */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
                <Radio className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                        {dongleName}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                        Dongle · Connected · {connLabel}
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={refresh}
                    disabled={loading}
                >
                    <RefreshCw className="mr-1.5 size-3.5" />
                    Refresh
                </Button>
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void disconnect()}
                >
                    <Power className="mr-1.5 size-3.5" />
                    Disconnect
                </Button>
            </div>

            {/* Node roster. */}
            <div className="flex-1 overflow-auto p-5">
                <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Nodes
                </h2>
                {loading && nodes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Scanning for nodes…
                    </p>
                ) : nodes.length === 0 ? (
                    <div className="rounded-[10px] border border-dashed border-border p-6 text-center">
                        <Cpu className="mx-auto mb-2 size-6 text-muted-foreground" />
                        <p className="text-sm font-medium">No paired nodes</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Put a node in pairing mode, press the pairing button
                            on the dongle, then refresh.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        {nodes.map((n) => (
                            <button
                                key={n.id}
                                type="button"
                                disabled={!n.online}
                                onClick={() => void handleOpen(n.id)}
                                className="flex items-center gap-3 rounded-[10px] border border-border bg-card px-3.5 py-3 text-left transition-colors hover:border-foreground/30 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Cpu className="size-5 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold">
                                        {n.label}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                        {n.online ? 'Online' : 'Offline'}
                                        {n.online && n.rssi
                                            ? ` · ${n.rssi} dBm`
                                            : ''}
                                        {n.hopCount
                                            ? ` · ${n.hopCount} hop${
                                                  n.hopCount > 1 ? 's' : ''
                                              }`
                                            : ''}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
