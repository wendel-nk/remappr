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

const MOD_LABELS: Array<[number, string, string]> = [
    [0x01, 'C', 'Left Ctrl'],
    [0x02, 'S', 'Left Shift'],
    [0x04, 'A', 'Left Alt'],
    [0x08, 'G', 'Left GUI'],
    [0x10, 'C', 'Right Ctrl'],
    [0x20, 'S', 'Right Shift'],
    [0x40, 'A', 'Right Alt'],
    [0x80, 'G', 'Right GUI'],
]

function activeMods(usage: number): Array<{ short: string; long: string }> {
    const flags = (usage >> 24) & 0xff
    if (!flags) return []
    return MOD_LABELS.filter(([b]) => flags & b).map(([, s, l]) => ({
        short: s,
        long: l,
    }))
}

export const HidUsageLabel = ({
    hid_usage,
}: HidUsageLabelProps): JSX.Element => {
    const [pageMut, id] = hidUsagePageAndIdFromUsage(hid_usage)

    const page = pageMut & 0xff

    const labels = hid_usage_get_labels(page, id)
    const baseShort = remove_prefix(labels.short)
    const baseLong = remove_prefix(labels.long || labels.med || labels.short)
    const mods = activeMods(hid_usage)
    const abbreviated = baseShort ? abbreviateKeyName(baseShort, 5) : baseShort
    const longTitle = mods.length
        ? mods.map((m) => m.long).join(' + ') + ' + ' + (baseLong ?? '')
        : baseLong

    return (
        <span
            className="inline-flex flex-col items-center justify-center leading-tight gap-px w-full"
            aria-label={longTitle}
            title={longTitle}
        >
            {mods.length > 0 && (
                <span className="flex gap-px justify-center text-[0.45em] font-bold opacity-80 leading-none tracking-tight">
                    {mods.map((m, i) => (
                        <span key={i}>{m.short}</span>
                    ))}
                </span>
            )}
            {abbreviated && (
                <span className="font-semibold">{abbreviated}</span>
            )}
        </span>
    )
}
