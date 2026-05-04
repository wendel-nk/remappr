// Pattern check: Strategy (Tier 1) — applied — MockCodec implements KeycodeCodec for demo flow; encodes/decodes (page<<16)|usage HID format with no firmware constraints.
import {HID_USAGE_BY_CANONICAL} from '../catalog/entries'
import type {CanonicalKeyId} from '../catalog/types'
import type {DecodedKeycode, EncodedKeycode, KeycodeCodec} from '../codec'

const BY_PACKED: Map<number, CanonicalKeyId> = new Map()
for ( const [id, usage] of HID_USAGE_BY_CANONICAL.entries() ) {
    BY_PACKED.set( (usage.page << 16) | usage.usage, id )
}

export class MockCodec implements KeycodeCodec {
    encode ( id: CanonicalKeyId ): EncodedKeycode | null {
        const usage = HID_USAGE_BY_CANONICAL.get( id )
        if ( usage ) {
            return {value: (usage.page << 16) | usage.usage}
        }
        return null
    }

    decode ( rawValue: number ): DecodedKeycode | null {
        const id = BY_PACKED.get( rawValue >>> 0 )
        return id ? {canonicalId: id} : null
    }

    supports ( id: CanonicalKeyId ): boolean {
        return HID_USAGE_BY_CANONICAL.has( id )
    }
}

export const mockCodec = new MockCodec()
