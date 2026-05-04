// Pattern check: Strategy (Tier 1) — applied — pluggable discovery providers per communication kind
import { getAdapters } from '@firmware'

export interface BleDiscovery {
    serviceUuid: string
    charUuid: string
}

export interface HidDiscovery {
    vendorIds?: number[]
    usagePage?: number
    usage?: number
}

export interface HidFilter {
    vendorId?: number
    productId?: number
    usagePage?: number
    usage?: number
}

export function bleDiscovery(): BleDiscovery | null {
    for (const adapter of getAdapters()) {
        const ble = adapter.discovery.ble
        if (ble) return { serviceUuid: ble.serviceUuid, charUuid: ble.charUuid }
    }
    return null
}

export function hidDiscovery(): HidDiscovery | null {
    for (const adapter of getAdapters()) {
        const hid = adapter.discovery.hid
        if (hid) {
            return {
                vendorIds: hid.vendorIds,
                usagePage: hid.usagePage,
                usage: hid.usage,
            }
        }
    }
    return null
}

// WebHID requestDevice() takes a filters array — emit one filter per
// registered adapter so all firmware variants surface in the chooser.
export function hidFilters(): HidFilter[] {
    const out: HidFilter[] = []
    for (const adapter of getAdapters()) {
        const hid = adapter.discovery.hid
        if (!hid) continue
        const vids =
            hid.vendorIds && hid.vendorIds.length > 0
                ? hid.vendorIds
                : [undefined]
        for (const vendorId of vids) {
            out.push({
                vendorId,
                usagePage: hid.usagePage,
                usage: hid.usage,
            })
        }
    }
    return out
}
