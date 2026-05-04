// Pattern check: no GoF pattern (-) — rejected — module-level Map memoization for hot-path O(1) lookup; not Singleton (no encapsulation/lifecycle), no abstraction.
// import { UsagePages } from "./data/HidUsageTables-1.5.json";
// Filtered with `cat src/HidUsageTables-1.5.json | jq '{ UsagePages: [.UsagePages[] | select([.Id] |inside([7, 12]))] }' > src/keyboard-and-consumer-usage-tables.json`
import {UsagePages} from '@/data/keyboard-and-consumer-usage-tables.json'
import HidOverrides from '@firmware/catalog/hid-pages/overrides.json'

interface HidLabels {
    short?: string
    med?: string
    long?: string
}

const overrides: Record<string, Record<string, HidLabels>> = HidOverrides

export interface UsageId {
    Id: number
    Name: string
}

export interface UsagePageInfo {
    Id: number
    Name: string
    UsageIds: UsageId[]
}

const pagesById = new Map<number, UsagePageInfo>(
    UsagePages.map( ( p: UsagePageInfo ): [number, UsagePageInfo] => [p.Id, p] ),
)

export const hidUsageFromPageAndId = ( page: number, id: number ): number =>
    (page << 16) + id

export const hidUsagePageAndIdFromUsage = ( usage: number ): [number, number] => [
    (usage >> 16) & 0xffff,
    usage & 0xffff,
]

export const hid_usage_get_labels = (
    usage_page: number,
    usage_id: number,
): {
    short?: string
    med?: string
    long?: string
} =>
    overrides[usage_page.toString()]?.[usage_id.toString()] || {
        short: pagesById
            .get( usage_page )
            ?.UsageIds?.find( ( u: UsageId ): boolean => u.Id === usage_id )?.Name,
    }
