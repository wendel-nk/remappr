import { describe, expect, it } from 'vitest'
import { zipStore, type ZipEntry } from './zip'

const enc = (s: string): Uint8Array => new TextEncoder().encode(s)
const dec = (b: Uint8Array): string => new TextDecoder().decode(b)

// Walk the stored (method 0) local file headers back out — validates that the
// offsets / lengths / signatures the writer emitted are self-consistent.
function readStoredZip(buf: Uint8Array): { path: string; text: string }[] {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    const out: { path: string; text: string }[] = []
    let p = 0
    while (p + 4 <= buf.length && dv.getUint32(p, true) === 0x04034b50) {
        const size = dv.getUint32(p + 22, true)
        const nameLen = dv.getUint16(p + 26, true)
        const extra = dv.getUint16(p + 28, true)
        const path = dec(buf.slice(p + 30, p + 30 + nameLen))
        const start = p + 30 + nameLen + extra
        out.push({ path, text: dec(buf.slice(start, start + size)) })
        p = start + size
    }
    return out
}

describe('zipStore', () => {
    const entries: ZipEntry[] = [
        { path: 'README.md', data: enc('# hello') },
        { path: 'config/board.keymap', data: enc('/ { keymap {}; };') },
    ]

    it('round-trips entries (paths + content) through the stored format', () => {
        const zip = zipStore(entries)
        expect(readStoredZip(zip)).toEqual([
            { path: 'README.md', text: '# hello' },
            { path: 'config/board.keymap', text: '/ { keymap {}; };' },
        ])
    })

    it('starts with the local-file signature and ends with EOCD count', () => {
        const zip = zipStore(entries)
        expect(zip[0]).toBe(0x50) // 'P'
        expect(zip[1]).toBe(0x4b) // 'K'
        const dv = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
        // EOCD is the last 22 bytes; total-entries at offset +10.
        const eocd = zip.length - 22
        expect(dv.getUint32(eocd, true)).toBe(0x06054b50)
        expect(dv.getUint16(eocd + 10, true)).toBe(2)
    })

    it('produces an empty but valid archive for no entries', () => {
        const zip = zipStore([])
        expect(zip.length).toBe(22) // EOCD only
        const dv = new DataView(zip.buffer)
        expect(dv.getUint32(0, true)).toBe(0x06054b50)
    })
})
