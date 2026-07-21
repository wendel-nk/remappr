import { describe, it, expect } from 'vitest'
import type { FirmwareAdapter } from '@firmware/adapter'
import { getAdapters, registerAdapter } from '@firmware/registry'
import { discoverableClientDirs } from './firmwareClients'
import { bleDiscoveryAll, hidDiscovery, hidDiscoveryAll } from './discovery'

// NOTE: these tests deliberately avoid the '@firmware' barrel and never execute
// the client barrels — importing real ZMK/QMK adapters pulls transport-client
// deps that don't resolve under vitest's node ESM (the Vite app bundles them
// fine). discoverableClientDirs() only reads glob KEYS, so no module runs.

describe('firmware client auto-discovery', () => {
    it('globs every adapter dir and excludes the non-adapter support dirs', () => {
        const dirs = discoverableClientDirs()
        // Proves the alias glob ('@firmware/*/index.ts') resolves and finds clients.
        expect(dirs).toEqual(
            expect.arrayContaining([
                'remappr',
                'zmk',
                'qmk',
                'qmk-vial',
                'keychron',
                'mock',
            ]),
        )
        // catalog/config ship an index.ts but register no adapter — must be filtered.
        expect(dirs).not.toContain('catalog')
        expect(dirs).not.toContain('config')
    })
})

describe('discovery priority (load-order independence)', () => {
    const fakeHidAdapter = (
        id: string,
        usagePage: number,
        ble?: { serviceUuid: string; charUuid: string },
    ): FirmwareAdapter =>
        ({
            id,
            displayName: id,
            discovery: {
                hid: { vendorIds: [usagePage], usagePage },
                ble,
            },
            canHandle: async () => ({ ok: false as const }),
            connect: async () => {
                throw new Error('not used')
            },
        }) as unknown as FirmwareAdapter

    it('pins the single HID filter to Remappr even when it registers last', () => {
        // Register a non-primary adapter FIRST, Remappr LAST — old behavior
        // (first-registered wins) would pick the non-primary one.
        registerAdapter(
            fakeHidAdapter('zmk', 0xff01, {
                serviceUuid: 'zmk-service',
                charUuid: 'zmk-rpc',
            }),
        )
        registerAdapter(
            fakeHidAdapter('remappr', 0xff00, {
                serviceUuid: 'remappr-service',
                charUuid: 'remappr-control',
            }),
        )
        expect(getAdapters().map((a) => a.id)).toEqual(['zmk', 'remappr'])
        expect(hidDiscovery()?.usagePage).toBe(0xff00)
    })

    it('hidDiscoveryAll surfaces every adapter filter, primary first', () => {
        // Reuses zmk(0xff01) + remappr(0xff00) from the test above, plus one more
        // non-primary family — the Electron path matches against ALL of them.
        registerAdapter(fakeHidAdapter('keychron', 0xff60))
        const pages = hidDiscoveryAll().map((f) => f.usagePage)
        expect(pages[0]).toBe(0xff00) // Remappr stays pinned first
        expect(pages).toEqual(expect.arrayContaining([0xff00, 0xff01, 0xff60]))
    })

    it('bleDiscoveryAll surfaces every firmware endpoint, primary first', () => {
        expect(bleDiscoveryAll()).toEqual([
            {
                adapterId: 'remappr',
                serviceUuid: 'remappr-service',
                charUuid: 'remappr-control',
            },
            {
                adapterId: 'zmk',
                serviceUuid: 'zmk-service',
                charUuid: 'zmk-rpc',
            },
        ])
    })
})
