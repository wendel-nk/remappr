// Pattern check: no GoF pattern (-) — rejected — vitest tests verifying CATALOG entries are unique by id and bucketed via groupForId helper.
import { describe, expect, it } from 'vitest'

import { keychronCodec } from '../keychron/codec'
import { mockCodec } from '../mock/codec'
import { qmkCodec } from '../qmk/codec'
import { vialCodec } from '../qmk-vial/codec'
import { zmkCodec } from '../zmk/codec'
import { CATALOG, HID_USAGE_BY_CANONICAL } from './entries'
import { CATALOG_PAGES, groupForId } from './pages'

describe('canonical catalog', () => {
    it('every entry has a unique id', () => {
        const seen = new Set<string>()
        for (const entry of CATALOG) {
            expect(seen.has(entry.id), `duplicate id: ${entry.id}`).toBe(false)
            seen.add(entry.id)
        }
    })

    it('every entry maps to a known page via groupForId', () => {
        const pageIds = new Set(CATALOG_PAGES.map((p) => p.id))
        for (const entry of CATALOG) {
            const page = groupForId(entry.id)
            expect(page, `no page for ${entry.id}`).not.toBeNull()
            expect(pageIds.has(page!), `unknown page ${page}`).toBe(true)
        }
    })

    it('HID page-7 entries are reachable by canonical id', () => {
        // "Keyboard A" → 'key.keyboard_a' with HID page 7, usage 0x04.
        const u = HID_USAGE_BY_CANONICAL.get('key.keyboard_a')
        expect(u?.page).toBe(7)
        expect(u?.usage).toBe(0x04)
    })

    it('contains wireless + os-keys + macros pages', () => {
        const ids = CATALOG_PAGES.map((p) => p.id)
        expect(ids).toContain('wireless')
        expect(ids).toContain('os-keys')
        expect(ids).toContain('macros')
    })

    it('every entry is encodable by at least one codec', () => {
        const codecs = [qmkCodec, keychronCodec, vialCodec, zmkCodec, mockCodec]
        const orphans: string[] = []
        for (const entry of CATALOG) {
            if (!codecs.some((c) => c.encode(entry.id) !== null)) {
                orphans.push(entry.id)
            }
        }
        expect(
            orphans,
            `orphaned canonical ids: ${orphans.join(', ')}`,
        ).toEqual([])
    })
})
