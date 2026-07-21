import { describe, expect, it, vi } from 'vitest'

import type { BleDiscovery } from './adapter/discovery'
import { bleOptionalServices, resolveBleEndpoint } from './bleEndpoints'

const endpoints: BleDiscovery[] = [
    {
        adapterId: 'remappr',
        serviceUuid: 'REMAPPR-SERVICE',
        charUuid: 'remappr-control',
    },
    {
        adapterId: 'zmk',
        serviceUuid: 'ZMK-SERVICE',
        charUuid: 'zmk-rpc',
    },
]

describe('BLE endpoint selection', () => {
    it('grants every unique firmware service UUID', () => {
        expect(
            bleOptionalServices([
                ...endpoints,
                { ...endpoints[1], adapterId: 'zmk-copy' },
            ]),
        ).toEqual(['remappr-service', 'zmk-service'])
    })

    it('falls through a missing Remappr service and resolves ZMK', async () => {
        const characteristic = { startNotifications: vi.fn() }
        const getPrimaryService = vi.fn(async (uuid: string) => {
            if (uuid === 'REMAPPR-SERVICE') {
                throw new DOMException('missing', 'NotFoundError')
            }
            return {
                getCharacteristic: vi.fn(async () => characteristic),
            }
        })

        const resolved = await resolveBleEndpoint(
            { getPrimaryService } as unknown as BluetoothRemoteGATTServer,
            endpoints,
        )

        expect(resolved.endpoint.adapterId).toBe('zmk')
        expect(resolved.characteristic).toBe(characteristic)
        expect(getPrimaryService).toHaveBeenCalledTimes(2)
    })

    it('does not hide a real GATT connection failure', async () => {
        const error = new DOMException('connection lost', 'NetworkError')
        const server = {
            getPrimaryService: vi.fn(async () => {
                throw error
            }),
        } as unknown as BluetoothRemoteGATTServer

        await expect(resolveBleEndpoint(server, endpoints)).rejects.toBe(error)
    })
})
