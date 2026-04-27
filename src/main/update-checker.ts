// pattern-check: skip — fetch + semver compare + IPC emit, with ETag caching, no abstraction
import { app, BrowserWindow, ipcMain } from 'electron'
import {
    IpcChannels,
    IpcEvents,
    type UpdateAvailablePayload,
} from '../shared/ipc-types'

const REPO_OWNER = 'Wolffyx'
const REPO_NAME = 'remappr'
const RELEASES_LATEST = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`

interface GitHubRelease {
    tag_name: string
    html_url: string
    body: string | null
}

export interface UpdateCheckResult {
    status: 'newer' | 'current' | 'unchanged' | 'error'
    version?: string
    url?: string
    error?: string
}

let cachedEtag: string | null = null
let cachedRelease: GitHubRelease | null = null

function parseSemver(v: string): [number, number, number] | null {
    const m = v.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/)
    if (!m) return null
    return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function isNewer(latest: string, current: string): boolean {
    const a = parseSemver(latest)
    const b = parseSemver(current)
    if (!a || !b) return false
    for (let i = 0; i < 3; i++) {
        if (a[i] > b[i]) return true
        if (a[i] < b[i]) return false
    }
    return false
}

function compareToCurrent(release: GitHubRelease): UpdateCheckResult {
    const latestTag = release.tag_name.replace(/^v/, '')
    const current = app.getVersion()
    if (isNewer(latestTag, current)) {
        return {
            status: 'newer',
            version: latestTag,
            url: release.html_url,
        }
    }
    return { status: 'current', version: latestTag }
}

export async function checkForUpdates(
    win: BrowserWindow | null,
): Promise<UpdateCheckResult> {
    try {
        const headers: Record<string, string> = {
            Accept: 'application/vnd.github+json',
        }
        if (cachedEtag) headers['If-None-Match'] = cachedEtag

        const res = await fetch(RELEASES_LATEST, { headers })

        if (res.status === 304 && cachedRelease) {
            return compareToCurrent(cachedRelease)
        }

        if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` }

        const etag = res.headers.get('etag')
        if (etag) cachedEtag = etag

        const release = (await res.json()) as GitHubRelease
        cachedRelease = release

        const result = compareToCurrent(release)

        if (result.status === 'newer' && win && !win.isDestroyed()) {
            const payload: UpdateAvailablePayload = {
                version: result.version!,
                url: result.url!,
                notes: release.body ?? '',
            }
            win.webContents.send(IpcEvents.UPDATE_AVAILABLE, payload)
        }

        return result
    } catch (err) {
        return {
            status: 'error',
            error: err instanceof Error ? err.message : 'unknown',
        }
    }
}

export function registerUpdateIpc(
    getMainWindow: () => BrowserWindow | null,
): void {
    ipcMain.handle(IpcChannels.UPDATES_CHECK, async () => {
        return checkForUpdates(getMainWindow())
    })
}
