// pattern-check: skip — localStorage CRUD helpers for the builder's board
// library; pure persistence functions, no abstraction (split from LibraryModal
// so the component file only exports components for react-refresh).
//
// Boards persist as serialized Remappr configs under localStorage
// `remappr.boards`, so a designed board can be saved, reopened, or removed
// without a backend. Ported from the prototype BuilderStore.jsx library helpers.
import { serializeKeymap, type ConfigKeymap } from '@firmware/config'
import { createLogger } from '@shared/logger'
import { slugifyId } from './geometryEditor'

const log = createLogger('BuilderLibrary')
const KEY = 'remappr.boards'

export interface BoardEntry {
    id: string
    name: string
    keys: number
    savedAt: number
    /** Serialized ConfigKeymap (the source of truth for this board). */
    source: string
}

export function loadBoards(): BoardEntry[] {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
        return Array.isArray(raw) ? (raw as BoardEntry[]) : []
    } catch (e) {
        log.error('failed to read library', e)
        return []
    }
}

function persist(boards: BoardEntry[]): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(boards))
    } catch (e) {
        log.error('failed to write library', e)
    }
}

/** Upsert the current board (keyed by id, newest first). */
export function saveBoard(config: ConfigKeymap): BoardEntry[] {
    const boards = loadBoards()
    const id = config.keyboard.id || slugifyId(config.meta.name) || 'board'
    const entry: BoardEntry = {
        id,
        name: config.meta.name,
        keys: config.keyboard.keys.length,
        savedAt: Date.now(),
        source: serializeKeymap(config),
    }
    const i = boards.findIndex((b) => b.id === id)
    if (i >= 0) boards[i] = entry
    else boards.unshift(entry)
    persist(boards)
    return boards
}

export function deleteBoard(id: string): BoardEntry[] {
    const boards = loadBoards().filter((b) => b.id !== id)
    persist(boards)
    return boards
}
