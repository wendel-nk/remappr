// Pattern check: no GoF pattern (-) — rejected — Vial keyboard def fetch + LZMA + KLE row parsing; pure functions over wire bytes.
// Vial firmware ships a per-board JSON definition compressed with raw LZMA1.
// Wire flow: GET_SIZE → GET_DEFINITION (block index) → concat → lzma1.decompress → JSON.

import { decompress as lzmaDecompress } from 'lzma1/lib/index.js'

import { ProtocolError } from '@firmware/errors'
import type { HidClient } from '@firmware/qmk/hidClient'
import { VIA_PAYLOAD_SIZE } from '@firmware/qmk/protocol'
import type { EncoderSlot, PhysicalLayoutKey } from '@firmware/types'

import { getDefinitionCmd, getSizeCmd, parseSize } from './protocol'

export interface VialCustomKeycode {
    name: string
    title: string
    shortName: string
}

export interface RawKeyboardDef {
    name?: string
    matrix: { rows: number; cols: number }
    layouts: { keymap: unknown[]; labels?: unknown[] }
    customKeycodes?: VialCustomKeycode[]
    vial?: { vibl?: boolean; midi?: unknown }
    lighting?: string
}

export interface ParsedKeyboardDef {
    name: string
    rows: number
    cols: number
    layoutKeys: PhysicalLayoutKey[]
    rowColMap: { row: number; col: number }[] // matches layoutKeys index → matrix coord
    encoderSlots: EncoderSlot[]
    encoderIndices: number[] // matches encoderSlots index → vial encoder index
    customKeycodes: VialCustomKeycode[]
    raw: RawKeyboardDef
}

export async function fetchKeyboardDefBytes(
    client: HidClient,
): Promise<Uint8Array> {
    const sizeResp = await client.send(getSizeCmd())
    const size = parseSize(sizeResp)
    if (size === 0 || size > 0x100000) {
        throw new ProtocolError(`Vial def: implausible size ${size}`)
    }
    const out = new Uint8Array(size)
    let written = 0
    let block = 0
    while (written < size) {
        const resp = await client.send(getDefinitionCmd(block))
        const remaining = size - written
        const take = Math.min(remaining, VIA_PAYLOAD_SIZE)
        out.set(resp.subarray(0, take), written)
        written += take
        block += 1
    }
    return out
}

export function decompressDef(bytes: Uint8Array): RawKeyboardDef {
    const decoded = lzmaDecompress(bytes)
    const u8 =
        decoded instanceof Uint8Array
            ? decoded
            : new Uint8Array((decoded as ArrayLike<number>).length)
    if (!(decoded instanceof Uint8Array)) {
        for (let i = 0; i < u8.length; i++) {
            u8[i] = (decoded as ArrayLike<number>)[i] & 0xff
        }
    }
    const text = new TextDecoder('utf-8').decode(u8)
    let json: unknown
    try {
        json = JSON.parse(text)
    } catch (err) {
        throw new ProtocolError(
            `Vial def: JSON parse failed: ${(err as Error).message}`,
        )
    }
    return validateDef(json)
}

function validateDef(json: unknown): RawKeyboardDef {
    if (!json || typeof json !== 'object') {
        throw new ProtocolError('Vial def: not an object')
    }
    const obj = json as Record<string, unknown>
    const matrix = obj.matrix as { rows?: unknown; cols?: unknown } | undefined
    const layouts = obj.layouts as
        | { keymap?: unknown; labels?: unknown }
        | undefined
    if (
        !matrix ||
        typeof matrix.rows !== 'number' ||
        typeof matrix.cols !== 'number'
    ) {
        throw new ProtocolError('Vial def: missing matrix.rows/cols')
    }
    if (!layouts || !Array.isArray(layouts.keymap)) {
        throw new ProtocolError('Vial def: missing layouts.keymap')
    }
    return obj as unknown as RawKeyboardDef
}

// --- KLE deserializer (minimal, ported from vial-gui kle_serial.py) -------------

interface KleKey {
    x: number
    y: number
    width: number
    height: number
    rotation_x: number
    rotation_y: number
    rotation_angle: number
    decal: boolean
    labels: (string | null)[]
}

const LABEL_MAP: number[][] = [
    [0, 6, 2, 8, 9, 11, 3, 5, 1, 4, 7, 10],
    [1, 7, -1, -1, 9, 11, 4, -1, -1, -1, -1, 10],
    [3, -1, 5, -1, 9, 11, -1, -1, 4, -1, -1, 10],
    [4, -1, -1, -1, 9, 11, -1, -1, -1, -1, -1, 10],
    [0, 6, 2, 8, 10, -1, 3, 5, 1, 4, 7, -1],
    [1, 7, -1, -1, 10, -1, 4, -1, -1, -1, -1, -1],
    [3, -1, 5, -1, 10, -1, -1, -1, 4, -1, -1, -1],
    [4, -1, -1, -1, 10, -1, -1, -1, -1, -1, -1, -1],
]

function reorderLabels(labels: string[], align: number): (string | null)[] {
    const out: (string | null)[] = new Array(12).fill(null)
    const map = LABEL_MAP[align] ?? LABEL_MAP[4]
    for (let i = 0; i < labels.length && i < map.length; i++) {
        const target = map[i]
        if (target >= 0 && labels[i]) out[target] = labels[i]
    }
    return out
}

function makeBlankKey(): KleKey {
    return {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation_x: 0,
        rotation_y: 0,
        rotation_angle: 0,
        decal: false,
        labels: [],
    }
}

function deserializeKle(rows: unknown[]): KleKey[] {
    const current = makeBlankKey()
    let clusterX = 0
    let clusterY = 0
    let align = 4
    const keys: KleKey[] = []

    for (let r = 0; r < rows.length; r++) {
        const row = rows[r]
        if (!Array.isArray(row)) continue
        for (let k = 0; k < row.length; k++) {
            const item = row[k]
            if (typeof item === 'string') {
                const newKey: KleKey = {
                    x: current.x,
                    y: current.y,
                    width: current.width,
                    height: current.height,
                    rotation_x: current.rotation_x,
                    rotation_y: current.rotation_y,
                    rotation_angle: current.rotation_angle,
                    decal: current.decal,
                    labels: reorderLabels(item.split('\n'), align),
                }
                keys.push(newKey)
                current.x += current.width
                current.width = 1
                current.height = 1
                current.decal = false
            } else if (item && typeof item === 'object') {
                const it = item as Record<string, unknown>
                if (typeof it.r === 'number') current.rotation_angle = it.r
                if (typeof it.rx === 'number') {
                    current.rotation_x = it.rx
                    clusterX = it.rx
                    current.x = clusterX
                    current.y = clusterY
                }
                if (typeof it.ry === 'number') {
                    current.rotation_y = it.ry
                    clusterY = it.ry
                    current.x = clusterX
                    current.y = clusterY
                }
                if (typeof it.a === 'number') align = it.a
                if (typeof it.x === 'number') current.x += it.x
                if (typeof it.y === 'number') current.y += it.y
                if (typeof it.w === 'number') current.width = it.w
                if (typeof it.h === 'number') current.height = it.h
                if (typeof it.d === 'boolean') current.decal = it.d
            }
        }
        current.y += 1
        current.x = current.rotation_x
    }
    return keys
}

export function parseKeyboardDef(def: RawKeyboardDef): ParsedKeyboardDef {
    const kleKeys = deserializeKle(def.layouts.keymap)
    const layoutKeys: PhysicalLayoutKey[] = []
    const rowColMap: { row: number; col: number }[] = []
    const encoderSlots: EncoderSlot[] = []
    const encoderIndices: number[] = []

    for (const key of kleKeys) {
        const tag = key.labels[0] ?? ''
        const isEncoder = key.labels[4] === 'e'
        if (isEncoder) {
            const [idxStr] = tag.split(',')
            const idx = Number.parseInt(idxStr ?? '', 10)
            if (!Number.isFinite(idx)) continue
            // De-dupe per encoder index — vial.json includes both directions.
            if (!encoderIndices.includes(idx)) {
                encoderIndices.push(idx)
                encoderSlots.push({ x: key.x, y: key.y })
            }
            continue
        }
        if (key.decal) continue
        if (!tag.includes(',')) continue
        const [rStr, cStr] = tag.split(',')
        const row = Number.parseInt(rStr, 10)
        const col = Number.parseInt(cStr, 10)
        if (!Number.isFinite(row) || !Number.isFinite(col)) continue
        const layoutKey: PhysicalLayoutKey = {
            x: key.x,
            y: key.y,
            w: key.width,
            h: key.height,
        }
        if (key.rotation_angle) layoutKey.r = key.rotation_angle
        if (key.rotation_x) layoutKey.rx = key.rotation_x
        if (key.rotation_y) layoutKey.ry = key.rotation_y
        layoutKeys.push(layoutKey)
        rowColMap.push({ row, col })
    }

    return {
        name: def.name ?? 'Vial keyboard',
        rows: def.matrix.rows,
        cols: def.matrix.cols,
        layoutKeys,
        rowColMap,
        encoderSlots,
        encoderIndices,
        customKeycodes: def.customKeycodes ?? [],
        raw: def,
    }
}

export async function fetchAndParseKeyboardDef(
    client: HidClient,
): Promise<ParsedKeyboardDef> {
    const bytes = await fetchKeyboardDefBytes(client)
    const def = decompressDef(bytes)
    return parseKeyboardDef(def)
}
