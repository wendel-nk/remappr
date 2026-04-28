import type { RpcTransport } from '@zmkfirmware/zmk-studio-ts-client/transport/index'
import type { FirmwareAdapter, ProbeHint } from './adapter'

const adapters: FirmwareAdapter[] = []

export function registerAdapter(adapter: FirmwareAdapter): void {
    if (adapters.some((a) => a.id === adapter.id)) return
    adapters.push(adapter)
}

export function getAdapters(): readonly FirmwareAdapter[] {
    return adapters
}

export async function pickAdapter(
    transport: RpcTransport,
    hint?: ProbeHint,
): Promise<FirmwareAdapter | null> {
    for (const adapter of adapters) {
        const probe = await adapter
            .canHandle(transport, hint)
            .catch(() => ({ ok: false as const }))
        if (probe.ok) return adapter
    }
    return null
}
