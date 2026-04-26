import {
    hid_usage_get_labels,
    hidUsagePageAndIdFromUsage,
} from '@/lib/behaviors/hidUsages'
import { abbreviateKeyName } from '@/lib/keyAbbreviations'

export interface HidUsageLabelProps {
    hid_usage: number
    header?: string
}

function remove_prefix(s?: string): string | undefined {
    return s?.replace(/^Keyboard /, '')
}

export const HidUsageLabel = ({
    hid_usage,
}: HidUsageLabelProps): JSX.Element => {
    const [pageMut, id] = hidUsagePageAndIdFromUsage(hid_usage)

    // TODO: Do something with implicit mods!
    const page = pageMut & 0xff

    const labels = hid_usage_get_labels(page, id)
    const shortLabel = remove_prefix(labels.short)
    const medLabel = remove_prefix(labels.med || labels.short)
    const longLabel = remove_prefix(labels.long || labels.med || labels.short)
    const abbreviated = shortLabel
        ? abbreviateKeyName(shortLabel, 5)
        : shortLabel

    return (
        <>
            {/*<span className="p-0 b-0 m-0 text-xs w-full h-full text-nowrap justify-self-start row-start-1 row-end-2 col-start-1 col-end-4 group-hover:inline-block group-hover:truncate @md:underline">*/}
            {/*        {header}*/}
            {/*    </span>*/}
            <span
                className="@[10em]:before:content-[attr(data-long-content)] @[6em]:before:content-[attr(data-med-content)] before:content-[attr(data-short-content)]"
                aria-label={longLabel}
                title={longLabel}
                data-short-content={abbreviated}
                data-med-content={medLabel}
                data-long-content={longLabel}
            />
        </>
    )
}
