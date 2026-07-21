import type { BleDiscovery } from './adapter/discovery'

export interface ResolvedBleEndpoint {
    endpoint: BleDiscovery
    characteristic: BluetoothRemoteGATTCharacteristic
}

export function bleOptionalServices(
    endpoints: readonly BleDiscovery[],
): string[] {
    return [...new Set(endpoints.map((e) => e.serviceUuid.toLowerCase()))]
}

function isNotFound(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'NotFoundError'
    )
}

/** Resolve the first registered firmware endpoint exposed by a connected
 * peripheral. A missing service/characteristic advances to the next firmware;
 * connection, permission, and transport failures remain fatal. */
export async function resolveBleEndpoint(
    server: BluetoothRemoteGATTServer,
    endpoints: readonly BleDiscovery[],
): Promise<ResolvedBleEndpoint> {
    let permissionError: unknown
    for (const endpoint of endpoints) {
        try {
            const service = await server.getPrimaryService(endpoint.serviceUuid)
            const characteristic = await service.getCharacteristic(
                endpoint.charUuid,
            )
            return { endpoint, characteristic }
        } catch (error) {
            if (
                typeof error === 'object' &&
                error !== null &&
                'name' in error &&
                error.name === 'SecurityError'
            ) {
                permissionError = error
                continue
            }
            if (!isNotFound(error)) throw error
        }
    }
    if (permissionError) throw permissionError
    throw new DOMException(
        'The selected device exposes no supported firmware configuration service.',
        'NotFoundError',
    )
}
