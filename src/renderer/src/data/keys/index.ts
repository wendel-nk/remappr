import keyboard from './keyboard.json'
import consumer from './consumer.json'
import ac from './ac.json'
import al from './al.json'
import media from './media.json'
import contact from './contact.json'

export interface KeyboardKeys {
    Kind: string
    Id: number
    Name: string
    UsageIds: Keys[]
    UsageIdGenerator: null
    slug: string
}

export interface Keys {
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

export const keyboards: KeyboardKeys[] = [
    {
        Kind: 'Defined',
        Id: 7,
        Name: 'Keyboard/Keypad',
        UsageIds: keyboard as Keys[],
        UsageIdGenerator: null,
        slug: 'keyboard',
    },
    {
        Kind: 'Defined',
        Id: 12,
        Name: 'Consumer',
        UsageIds: consumer as Keys[],
        UsageIdGenerator: null,
        slug: 'consumer',
    },
    {
        Kind: 'Defined',
        Id: 12,
        Name: 'AC',
        UsageIds: ac as Keys[],
        UsageIdGenerator: null,
        slug: 'ac',
    },
    {
        Kind: 'Defined',
        Id: 12,
        Name: 'AL',
        UsageIds: al as Keys[],
        UsageIdGenerator: null,
        slug: 'al',
    },
    {
        Kind: 'Defined',
        Id: 12,
        Name: 'Contact',
        UsageIds: contact as Keys[],
        UsageIdGenerator: null,
        slug: 'ac',
    },
    {
        Kind: 'Defined',
        Id: 12,
        Name: 'Media',
        UsageIds: media as Keys[],
        UsageIdGenerator: null,
        slug: 'media',
    },
]
