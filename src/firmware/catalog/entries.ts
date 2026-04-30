// Pattern check: no GoF pattern (-) — rejected — JSON-to-entry data transformation; loads + normalizes static records, no abstraction.
import keyboardJson from './hid-pages/keyboard.json'
import consumerJson from './hid-pages/consumer.json'
import acJson from './hid-pages/ac.json'
import alJson from './hid-pages/al.json'
import mediaJson from './hid-pages/media.json'
import contactJson from './hid-pages/contact.json'
import overridesJson from './hid-pages/overrides.json'

import type { CanonicalKeyId, CatalogEntry } from './types'

interface HidLabelOverride {
    short?: string
    med?: string
    long?: string
}

const OVERRIDES = overridesJson as Record<
    string,
    Record<string, HidLabelOverride>
>

const lookupOverride = (
    page: number,
    id: number,
): HidLabelOverride | undefined => OVERRIDES[String(page)]?.[String(id)]

interface RawHidEntry {
    Id: number
    Name: string
    Label?: string
    Label2?: string
    Kinds?: string[]
    w?: number
    h?: number
    x?: number
    y?: number
}

const slugify = (s: string): string =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')

export interface HidUsage {
    page: number
    usage: number
}

interface HidPageBuild {
    entries: CatalogEntry[]
    usages: Map<CanonicalKeyId, HidUsage>
}

const fromHidPage = (
    raw: RawHidEntry[],
    idPrefix: string,
    pageHidNumber: number,
): HidPageBuild => {
    const entries: CatalogEntry[] = []
    const usages = new Map<CanonicalKeyId, HidUsage>()
    for (const r of raw) {
        const slug = slugify(r.Name) || `id_${r.Id}`
        const id = `${idPrefix}.${slug}`
        const ov = lookupOverride(pageHidNumber, r.Id)
        entries.push({
            id,
            label: ov?.short ?? r.Label ?? r.Name,
            name: ov?.long ?? ov?.med ?? r.Name,
            description: r.Label2,
            x: r.x,
            y: r.y,
            w: r.w,
            h: r.h,
            kinds: ['hid'],
        })
        usages.set(id, { page: pageHidNumber, usage: r.Id })
    }
    return { entries, usages }
}

const keyboardBuild = fromHidPage(keyboardJson as RawHidEntry[], 'key', 7)
const consumerBuild = fromHidPage(consumerJson as RawHidEntry[], 'consumer', 12)
const acBuild = fromHidPage(acJson as RawHidEntry[], 'ac', 12)
const alBuild = fromHidPage(alJson as RawHidEntry[], 'al', 12)
const mediaBuild = fromHidPage(mediaJson as RawHidEntry[], 'media', 12)
const contactBuild = fromHidPage(contactJson as RawHidEntry[], 'contact', 12)

export {
    AUDIO_ENTRIES,
    BACKLIGHT_ENTRIES,
    JOYSTICK_ENTRIES,
    MACROS_ENTRIES,
    MAGIC_ENTRIES,
    MEDIA_TRANSPORT_ENTRIES,
    MIDI_ENTRIES,
    MISC_ENTRIES,
    MOD_ENTRIES,
    MOUSE_ENTRIES,
    OS_KEYS_ENTRIES,
    PROGRAMMABLE_ENTRIES,
    QUANTUM_ENTRIES,
    RGB_ENTRIES,
    SHIFTED_ENTRIES,
    WIRELESS_ENTRIES,
} from './static-entries'
import { STATIC_ENTRIES } from './static-entries'

export const KEYBOARD_ENTRIES = keyboardBuild.entries
export const CONSUMER_ENTRIES = consumerBuild.entries
export const AC_ENTRIES = acBuild.entries
export const AL_ENTRIES = alBuild.entries
export const MEDIA_ENTRIES = mediaBuild.entries
export const CONTACT_ENTRIES = contactBuild.entries

export const CATALOG: CatalogEntry[] = [
    ...KEYBOARD_ENTRIES,
    ...CONSUMER_ENTRIES,
    ...AC_ENTRIES,
    ...AL_ENTRIES,
    ...MEDIA_ENTRIES,
    ...CONTACT_ENTRIES,
    ...STATIC_ENTRIES,
]

// Codecs use this to encode canonical HID entries → wire usage pair.
export const HID_USAGE_BY_CANONICAL: Map<CanonicalKeyId, HidUsage> = new Map([
    ...keyboardBuild.usages,
    ...consumerBuild.usages,
    ...acBuild.usages,
    ...alBuild.usages,
    ...mediaBuild.usages,
    ...contactBuild.usages,
])
