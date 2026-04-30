// Pattern check: Strategy (Tier 1) — applied — ZmkCodec implements KeycodeCodec for ZMK behavior bindings; HID page 7 + page 12 → ZMK key_press / consumer_press.
import { HID_USAGE_BY_CANONICAL } from '../catalog/entries'
import type { CanonicalKeyId } from '../catalog/types'
import type { DecodedKeycode, EncodedKeycode, KeycodeCodec } from '../codec'

const BY_PACKED: Map<number, CanonicalKeyId> = new Map()
for (const [id, usage] of HID_USAGE_BY_CANONICAL.entries()) {
    BY_PACKED.set((usage.page << 16) | usage.usage, id)
}

// ZMK speaks raw HID usages directly via &kp / &cp behaviors. The packed
// 32-bit value matches src/renderer/src/lib/actions/hidUsages.ts:25 today.
export class ZmkCodec implements KeycodeCodec {
    encode(id: CanonicalKeyId): EncodedKeycode | null {
        const usage = HID_USAGE_BY_CANONICAL.get(id)
        if (usage) return { value: (usage.page << 16) | usage.usage }
        return null
    }

    decode(rawValue: number): DecodedKeycode | null {
        const id = BY_PACKED.get(rawValue >>> 0)
        return id ? { canonicalId: id } : null
    }

    supports(id: CanonicalKeyId): boolean {
        return HID_USAGE_BY_CANONICAL.has(id)
    }
}

export const zmkCodec = new ZmkCodec()
