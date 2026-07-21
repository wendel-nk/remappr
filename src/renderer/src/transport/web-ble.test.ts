import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@firmware', () => ({
    UserCancelledError: class UserCancelledError extends Error {},
}))

import { UserCancelledError } from '@firmware'
import type { BleDiscovery } from './adapter/discovery'
import {
    connectToGrantedDevice,
    listGrantedDevices,
    requestAndConnect,
    webBluetoothRequestOptions,
} from './web-ble'

const endpoints: BleDiscovery[] = [
    {
        adapterId: 'remappr',
        serviceUuid: '00000000-0000-0000-0000-000000000001',
        charUuid: '00000000-0000-0000-0000-000000000002',
    },
    {
        adapterId: 'zmk',
        serviceUuid: '00000000-0000-0000-0000-000000000003',
        charUuid: '00000000-0000-0000-0000-000000000004',
    },
]

interface FakeBleDevice {
    device: BluetoothDevice
    characteristic: BluetoothRemoteGATTCharacteristic
    connect: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    getPrimaryService: ReturnType<typeof vi.fn>
    startNotifications: ReturnType<typeof vi.fn>
    stopNotifications: ReturnType<typeof vi.fn>
    writeValueWithoutResponse: ReturnType<typeof vi.fn>
}

function fakeBleDevice(): FakeBleDevice {
    const characteristicTarget = new EventTarget()
    const startNotifications = vi.fn(async () => characteristic)
    const stopNotifications = vi.fn(async () => characteristic)
    const writeValueWithoutResponse = vi.fn(async () => undefined)
    const characteristic = Object.assign(characteristicTarget, {
        value: undefined,
        startNotifications,
        stopNotifications,
        writeValueWithoutResponse,
    }) as unknown as BluetoothRemoteGATTCharacteristic
    const service = {
        getCharacteristic: vi.fn(async (uuid: string) => {
            if (uuid !== endpoints[1].charUuid) {
                throw new DOMException('missing', 'NotFoundError')
            }
            return characteristic
        }),
    } as unknown as BluetoothRemoteGATTService
    const disconnect = vi.fn()
    const getPrimaryService = vi.fn(async (uuid: string) => {
        if (uuid !== endpoints[1].serviceUuid) {
            throw new DOMException('missing', 'NotFoundError')
        }
        return service
    })
    const server = {
        connected: false,
        connect: vi.fn(),
        disconnect,
        getPrimaryService,
    } as unknown as BluetoothRemoteGATTServer
    const connect = vi.fn(async () => {
        Object.assign(server, { connected: true })
        return server
    })
    Object.assign(server, { connect })
    const device = Object.assign(new EventTarget(), {
        id: 'device-1',
        name: 'NK65',
        gatt: server,
    }) as unknown as BluetoothDevice

    return {
        device,
        characteristic,
        connect,
        disconnect,
        getPrimaryService,
        startNotifications,
        stopNotifications,
        writeValueWithoutResponse,
    }
}

let requestDevice: ReturnType<typeof vi.fn>
let getDevices: ReturnType<typeof vi.fn>

beforeEach(() => {
    requestDevice = vi.fn()
    getDevices = vi.fn(async () => [])
    vi.stubGlobal('navigator', {
        bluetooth: { requestDevice, getDevices },
    })
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('browser Web Bluetooth transport', () => {
    it('requests every firmware service and tags the resolved adapter', async () => {
        const fake = fakeBleDevice()
        requestDevice.mockResolvedValue(fake.device)

        const transport = await requestAndConnect(endpoints)

        expect(requestDevice).toHaveBeenCalledWith({
            acceptAllDevices: true,
            optionalServices: endpoints.map((endpoint) => endpoint.serviceUuid),
        })
        expect(fake.getPrimaryService).toHaveBeenCalledTimes(2)
        expect(fake.startNotifications).toHaveBeenCalledOnce()
        expect(transport.firmwareAdapterId).toBe('zmk')

        const writer = transport.writable.getWriter()
        await writer.write(new Uint8Array(45))
        expect(
            fake.writeValueWithoutResponse.mock.calls.map(
                ([chunk]) => (chunk as Uint8Array).byteLength,
            ),
        ).toEqual([20, 20, 5])
        transport.abortController.abort()
        await vi.waitFor(() =>
            expect(fake.stopNotifications).toHaveBeenCalledOnce(),
        )
        expect(fake.disconnect).toHaveBeenCalledOnce()
    })

    it('preserves a notification DataView offset and length', async () => {
        const fake = fakeBleDevice()
        requestDevice.mockResolvedValue(fake.device)
        const transport = await requestAndConnect(endpoints)
        const reader = transport.readable.getReader()
        const bytes = new Uint8Array([99, 1, 2, 3, 88])
        Object.assign(fake.characteristic, {
            value: new DataView(bytes.buffer, 1, 3),
        })

        fake.characteristic.dispatchEvent(
            new Event('characteristicvaluechanged'),
        )

        const result = await reader.read()
        expect([...result.value!]).toEqual([1, 2, 3])
        transport.abortController.abort()
    })

    it('closes the response stream when GATT disconnects', async () => {
        const fake = fakeBleDevice()
        requestDevice.mockResolvedValue(fake.device)
        const transport = await requestAndConnect(endpoints)
        const reader = transport.readable.getReader()

        fake.device.dispatchEvent(new Event('gattserverdisconnected'))

        await expect(reader.read()).resolves.toEqual({
            value: undefined,
            done: true,
        })
    })

    it('reopens a previously granted device without invoking the chooser', async () => {
        const fake = fakeBleDevice()
        getDevices.mockResolvedValue([fake.device])

        const devices = await listGrantedDevices()
        const transport = await connectToGrantedDevice(devices[0], endpoints)

        expect(devices).toEqual([{ id: 'web-ble:device-1', label: 'NK65' }])
        expect(requestDevice).not.toHaveBeenCalled()
        expect(transport.firmwareAdapterId).toBe('zmk')
        transport.abortController.abort()
    })

    it('retains devices granted during this page session without getDevices', async () => {
        const fake = fakeBleDevice()
        requestDevice.mockResolvedValue(fake.device)
        vi.stubGlobal('navigator', { bluetooth: { requestDevice } })

        const transport = await requestAndConnect(endpoints)
        expect(await listGrantedDevices()).toEqual([
            { id: 'web-ble:device-1', label: 'NK65' },
        ])
        transport.abortController.abort()
    })

    it('disconnects and reports an unsupported selected device as a setup error', async () => {
        const fake = fakeBleDevice()
        fake.getPrimaryService.mockRejectedValue(
            new DOMException('missing', 'NotFoundError'),
        )
        requestDevice.mockResolvedValue(fake.device)

        await expect(requestAndConnect(endpoints)).rejects.toThrow(
            'does not expose a supported firmware configuration service',
        )
        expect(fake.disconnect).toHaveBeenCalledOnce()
    })

    it('maps a cancelled browser chooser to UserCancelledError', async () => {
        requestDevice.mockRejectedValue(
            new DOMException('chooser closed', 'NotFoundError'),
        )

        await expect(requestAndConnect(endpoints)).rejects.toBeInstanceOf(
            UserCancelledError,
        )
    })

    it('deduplicates service permissions in request options', () => {
        expect(
            webBluetoothRequestOptions([
                ...endpoints,
                { ...endpoints[1], adapterId: 'zmk-copy' },
            ]).optionalServices,
        ).toEqual(endpoints.map((endpoint) => endpoint.serviceUuid))
    })
})
