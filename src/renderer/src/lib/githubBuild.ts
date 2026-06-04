// Pattern check: no GoF pattern (-) — rejected — a thin closure-based REST client
// over an injected fetch; HTTP request shaping, no abstraction or polymorphism.
//
// Minimal GitHub REST client for the Phase-1 cloud-build convenience path: push a
// generated project bundle to the user's own repo, let Actions build it, then
// fetch the firmware artifact. Auth is a personal access token (repo + workflow
// scopes) — no OAuth backend needed for an owner tool. `fetch` is injected so the
// request shaping is unit-testable without network. GitHub's REST API sends CORS
// headers, so this runs fine from the renderer. (Distinct from lib/github.ts,
// which only reads this app's own GitHub Releases for self-update.)

const API = 'https://api.github.com'

export interface BundleFile {
    /** Path within the repo, e.g. "config/board.keymap". */
    path: string
    content: string
}

export interface WorkflowRun {
    id: number
    status: string // queued | in_progress | completed
    conclusion: string | null // success | failure | … (null until completed)
    htmlUrl: string
}

export interface Artifact {
    id: number
    name: string
    archiveDownloadUrl: string
}

// pattern-check: skip — remove localStorage token helpers; token now lives in
// lib/secretStore (safeStorage on desktop). Interface below is unchanged.
export interface GithubBuildClient {
    getUser(): Promise<{ login: string }>
    ensureRepo(
        name: string,
        opts?: { private?: boolean },
    ): Promise<{ owner: string; name: string; defaultBranch: string }>
    commitFiles(
        owner: string,
        repo: string,
        branch: string,
        files: BundleFile[],
        message: string,
    ): Promise<{ commitSha: string }>
    /** Latest workflow run, optionally scoped to a specific pushed commit
     *  (`headSha`) so polling never latches onto a stale prior run. */
    getLatestRun(
        owner: string,
        repo: string,
        headSha?: string,
    ): Promise<WorkflowRun | null>
    listArtifacts(
        owner: string,
        repo: string,
        runId: number,
    ): Promise<Artifact[]>
    downloadArtifact(url: string): Promise<Uint8Array>
}

export function createGithubBuildClient(
    token: string,
    fetchImpl: typeof fetch = fetch,
): GithubBuildClient {
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    }

    async function req<T>(
        method: string,
        path: string,
        body?: unknown,
    ): Promise<T> {
        const res = await fetchImpl(`${API}${path}`, {
            method,
            headers: body
                ? { ...headers, 'Content-Type': 'application/json' }
                : headers,
            body: body ? JSON.stringify(body) : undefined,
        })
        if (!res.ok) {
            const detail = await res.text().catch(() => '')
            throw new Error(
                `GitHub ${method} ${path} → ${res.status}${detail ? `: ${detail}` : ''}`,
            )
        }
        return (await res.json()) as T
    }

    const getUser: GithubBuildClient['getUser'] = () =>
        req<{ login: string }>('GET', '/user')

    const ensureRepo: GithubBuildClient['ensureRepo'] = async (name, opts) => {
        const { login } = await getUser()
        const res = await fetchImpl(`${API}/repos/${login}/${name}`, {
            headers,
        })
        if (res.ok) {
            const repo = (await res.json()) as { default_branch: string }
            return { owner: login, name, defaultBranch: repo.default_branch }
        }
        // 404 → create it (auto-init so a default branch + base commit exist).
        const created = await req<{ default_branch: string }>(
            'POST',
            '/user/repos',
            { name, private: opts?.private ?? true, auto_init: true },
        )
        return { owner: login, name, defaultBranch: created.default_branch }
    }

    // Atomic multi-file commit via the Git Data API: tree entries carry inline
    // content (no separate blob uploads), then a commit advances the branch ref.
    const commitFiles: GithubBuildClient['commitFiles'] = async (
        owner,
        repo,
        branch,
        files,
        message,
    ) => {
        const ref = await req<{ object: { sha: string } }>(
            'GET',
            `/repos/${owner}/${repo}/git/ref/heads/${branch}`,
        )
        const baseSha = ref.object.sha
        const baseCommit = await req<{ tree: { sha: string } }>(
            'GET',
            `/repos/${owner}/${repo}/git/commits/${baseSha}`,
        )
        const tree = await req<{ sha: string }>(
            'POST',
            `/repos/${owner}/${repo}/git/trees`,
            {
                base_tree: baseCommit.tree.sha,
                tree: files.map((f) => ({
                    path: f.path,
                    mode: '100644',
                    type: 'blob',
                    content: f.content,
                })),
            },
        )
        const commit = await req<{ sha: string }>(
            'POST',
            `/repos/${owner}/${repo}/git/commits`,
            { message, tree: tree.sha, parents: [baseSha] },
        )
        await req('PATCH', `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
            sha: commit.sha,
        })
        return { commitSha: commit.sha }
    }

    const getLatestRun: GithubBuildClient['getLatestRun'] = async (
        owner,
        repo,
        headSha,
    ) => {
        // Scope to the just-pushed commit when known: otherwise the newest run
        // might be a leftover from a previous push (whose stale "completed"
        // conclusion would end polling against the wrong build).
        const query = headSha
            ? `?head_sha=${encodeURIComponent(headSha)}&per_page=1`
            : `?per_page=1`
        const res = await req<{
            workflow_runs: {
                id: number
                status: string
                conclusion: string | null
                html_url: string
            }[]
        }>('GET', `/repos/${owner}/${repo}/actions/runs${query}`)
        const run = res.workflow_runs[0]
        if (!run) return null
        return {
            id: run.id,
            status: run.status,
            conclusion: run.conclusion,
            htmlUrl: run.html_url,
        }
    }

    const listArtifacts: GithubBuildClient['listArtifacts'] = async (
        owner,
        repo,
        runId,
    ) => {
        const res = await req<{
            artifacts: {
                id: number
                name: string
                archive_download_url: string
            }[]
        }>('GET', `/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`)
        return res.artifacts.map((a) => ({
            id: a.id,
            name: a.name,
            archiveDownloadUrl: a.archive_download_url,
        }))
    }

    const downloadArtifact: GithubBuildClient['downloadArtifact'] = async (
        url,
    ) => {
        const res = await fetchImpl(url, { headers })
        if (!res.ok) throw new Error(`GitHub artifact download → ${res.status}`)
        return new Uint8Array(await res.arrayBuffer())
    }

    return {
        getUser,
        ensureRepo,
        commitFiles,
        getLatestRun,
        listArtifacts,
        downloadArtifact,
    }
}
