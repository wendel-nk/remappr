// Pattern check: Strategy (Tier 1) — extended — registry-backed env dispatch replaces inline builder table
/**
 * Thin entry point for the transport system.
 *
 * Adapters self-register via `registerTransport()` at module load. The
 * side-effect imports below pull each adapter family into the bundle and
 * trigger registration. `getTransports()` then walks the registry,
 * filters by current env, and returns the public-facing factories.
 *
 * Add a new transport by creating a new adapter module under
 * `src/renderer/src/<env>/<kind>.ts` (or `transport/web-*.ts`), calling
 * `registerTransport({...})` at module load, and adding the side-effect
 * import here.
 */

import type { TransportFactory } from '../transport/types'
import { detectEnv, isElectron } from '../transport/adapter/env'
import {
    getRegisteredTransports,
    subscribeAllChanges,
} from '../transport/adapter/registry'

// Side-effect imports — each adapter module calls registerTransport()
import '../electron/serial'
import '../electron/ble'
import '../electron/hid'
import '../transport/web-serial'
import '../transport/web-hid'
import '../transport/web-ble'

export { isElectron }

let cachedTransports: TransportFactory[] | null = null

export function getTransports(): TransportFactory[] {
    return (cachedTransports ??= getRegisteredTransports(detectEnv()))
}

export function subscribeToTransportChanges(cb: () => void): () => void {
    return subscribeAllChanges(detectEnv(), cb)
}
