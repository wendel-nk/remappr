// pattern-check: skip — localStorage CRUD helpers for the builder's board
// library; pure persistence functions, no abstraction (split from LibraryModal
// so the component file only exports components for react-refresh).
//
// Boards persist as serialized Remappr configs under localStorage
// `remappr.boards`, so a designed board can be saved, reopened, or removed
// without a backend. Ported from the prototype BuilderStore.jsx library helpers.
import {
    serializeKeymap,
    type CanonGeometry,
    type ConfigKeymap,
} from '@firmware/config'
import { createLogger } from '@shared/logger'
import type { PreviewKey } from '@/stores/devicePreviewStore'
import { slugifyId } from './geometryEditor'

const log = createLogger('BuilderLibrary')
const KEY = 'remappr.boards'

export interface BoardEntry {
    /** Unique per-save id (`baseId__timestamp`) so multiple snapshots coexist. */
    id: string
    name: string
    keys: number
    savedAt: number
    /** Serialized ConfigKeymap (the source of truth for this board). */
    source: string
    /** Layout silhouette for the list thumbnail; absent on pre-preview saves. */
    preview?: PreviewKey[]
}

// pattern-check: skip pure geometry→preview data mapper, no abstraction
/** Map raw board geometry to the start-page preview shape (silhouette only —
 *  neutral category, no resolved legends). Used for the library thumbnail. */
export function geometryToPreviewKeys(keys: CanonGeometry[]): PreviewKey[] {
    return keys.map((k) => ({
        x: k.x,
        y: k.y,
        width: k.w,
        height: k.h,
        r: k.r,
        rx: k.rx,
        ry: k.ry,
        category: 'alpha',
        tap: '',
    }))
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

// pattern-check: skip localStorage persistence helper, no abstraction
/** Save the current board as a new snapshot (newest first). Each save is a
 *  distinct entry — a unique `baseId__timestamp` id — so multiple builds coexist
 *  instead of overwriting by board id. */
export function saveBoard(config: ConfigKeymap): BoardEntry[] {
    const boards = loadBoards()
    const baseId = config.keyboard.id || slugifyId(config.meta.name) || 'board'
    const entry: BoardEntry = {
        id: `${baseId}__${Date.now()}`,
        name: config.meta.name,
        keys: config.keyboard.keys.length,
        savedAt: Date.now(),
        source: serializeKeymap(config),
        preview: geometryToPreviewKeys(config.keyboard.keys),
    }
    boards.unshift(entry)
    persist(boards)
    return boards
}

export function deleteBoard(id: string): BoardEntry[] {
    const boards = loadBoards().filter((b) => b.id !== id)
    persist(boards)
    return boards
}
