// Pattern check: no GoF pattern (-) — rejected — pure draft↔ConfigHardware
// mapping functions backing the builder's hardware form; data transforms, no
// abstraction or polymorphism.
//
// The builder's hardware panel edits free text (board name, GPIO lists, debounce
// numbers); these helpers lower that editable `HardwareDraft` into the canonical
// `ConfigHardware` (and back) so the React component stays presentational. The
// matrix-transform is NOT edited here yet — it is carried through untouched so
// the compiler keeps the real (or geometry-derived) transform.

import type {
    CanonKscan,
    CanonMatrixTransform,
    ConfigHardware,
    DiodeDirection,
} from '@firmware/config'

export type KscanKind = 'none' | 'matrix' | 'direct'

/** Editable form shape: every field is a string (GPIO lists are one-spec-per-line
 *  multiline text) so inputs bind directly and partial/invalid input never throws. */
export interface HardwareDraft {
    board: string
    shield: string
    kscanKind: KscanKind
    diodeDirection: DiodeDirection
    rowGpios: string
    colGpios: string
    inputGpios: string
    debouncePressMs: string
    debounceReleaseMs: string
}

export const EMPTY_DRAFT: HardwareDraft = {
    board: '',
    shield: '',
    kscanKind: 'none',
    diodeDirection: 'col2row',
    rowGpios: '',
    colGpios: '',
    inputGpios: '',
    debouncePressMs: '',
    debounceReleaseMs: '',
}

/** Split a GPIO textarea into trimmed, non-empty spec lines. */
export function parseGpioLines(text: string): string[] {
    return text
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
}

const joinGpios = (specs: string[] | undefined): string =>
    (specs ?? []).join('\n')

const numToStr = (n: number | undefined): string =>
    n === undefined ? '' : String(n)

/** Parse a debounce field: a non-negative integer, or undefined when blank/invalid. */
function parseDebounce(s: string): number | undefined {
    const t = s.trim()
    if (!t) return undefined
    const n = Number(t)
    return Number.isInteger(n) && n >= 0 ? n : undefined
}

/** Seed a draft from existing canonical hardware (or empties when none). */
export function hardwareToDraft(hw: ConfigHardware | undefined): HardwareDraft {
    if (!hw) return { ...EMPTY_DRAFT }
    const k = hw.kscan
    return {
        board: hw.board ?? '',
        shield: hw.shield ?? '',
        kscanKind: k?.type ?? 'none',
        diodeDirection: k?.type === 'matrix' ? k.diodeDirection : 'col2row',
        rowGpios: k?.type === 'matrix' ? joinGpios(k.rowGpios) : '',
        colGpios: k?.type === 'matrix' ? joinGpios(k.colGpios) : '',
        inputGpios: k?.type === 'direct' ? joinGpios(k.inputGpios) : '',
        debouncePressMs: numToStr(k?.debouncePressMs),
        debounceReleaseMs: numToStr(k?.debounceReleaseMs),
    }
}

/** Build canonical hardware from the draft. `prevTransform` is carried through
 *  unchanged (the form does not edit the RC() map). Returns undefined when the
 *  draft is effectively empty, so a cleared form drops the hardware block. */
export function draftToHardware(
    draft: HardwareDraft,
    prevTransform?: CanonMatrixTransform,
): ConfigHardware | undefined {
    const board = draft.board.trim()
    const shield = draft.shield.trim()
    const dp = parseDebounce(draft.debouncePressMs)
    const dr = parseDebounce(draft.debounceReleaseMs)
    const debounce = {
        ...(dp !== undefined ? { debouncePressMs: dp } : {}),
        ...(dr !== undefined ? { debounceReleaseMs: dr } : {}),
    }

    let kscan: CanonKscan | undefined
    if (draft.kscanKind === 'matrix') {
        kscan = {
            type: 'matrix',
            diodeDirection: draft.diodeDirection,
            rowGpios: parseGpioLines(draft.rowGpios),
            colGpios: parseGpioLines(draft.colGpios),
            ...debounce,
        }
    } else if (draft.kscanKind === 'direct') {
        kscan = {
            type: 'direct',
            inputGpios: parseGpioLines(draft.inputGpios),
            ...debounce,
        }
    }

    const hw: ConfigHardware = {
        ...(board ? { board } : {}),
        ...(shield ? { shield } : {}),
        ...(kscan ? { kscan } : {}),
        ...(prevTransform ? { transform: prevTransform } : {}),
    }
    return Object.keys(hw).length ? hw : undefined
}
