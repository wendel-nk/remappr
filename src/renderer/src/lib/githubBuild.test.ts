import { describe, expect, it, vi } from 'vitest'
import { createGithubBuildClient } from './githubBuild'

const json = (data: unknown, ok = true, status = 200): Response =>
    ({
        ok,
        status,
        json: async () => data,
        text: async () => JSON.stringify(data),
        arrayBuffer: async () => new ArrayBuffer(0),
    }) as unknown as Response

// A tiny router fake: matches on "METHOD pathname" and returns canned responses.
function router(routes: Record<string, () => Response>): typeof fetch {
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input))
        const key = `${init?.method ?? 'GET'} ${url.pathname}${url.search}`
        const handler = routes[key]
        if (!handler) throw new Error(`unrouted: ${key}`)
        return handler()
    }) as unknown as typeof fetch
}

describe('githubBuild client', () => {
    it('getUser hits /user with auth', async () => {
        const fetchImpl = router({ 'GET /user': () => json({ login: 'ann' }) })
        const c = createGithubBuildClient('tok', fetchImpl)
        expect(await c.getUser()).toEqual({ login: 'ann' })
        const headers = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
            .calls[0][1].headers
        expect(headers.Authorization).toBe('Bearer tok')
    })

    it('ensureRepo returns an existing repo without creating it', async () => {
        const c = createGithubBuildClient(
            'tok',
            router({
                'GET /user': () => json({ login: 'ann' }),
                'GET /repos/ann/kb': () => json({ default_branch: 'main' }),
            }),
        )
        expect(await c.ensureRepo('kb')).toEqual({
            owner: 'ann',
            name: 'kb',
            defaultBranch: 'main',
        })
    })

    it('ensureRepo creates the repo when missing (404 → POST)', async () => {
        const c = createGithubBuildClient(
            'tok',
            router({
                'GET /user': () => json({ login: 'ann' }),
                'GET /repos/ann/kb': () => json({}, false, 404),
                'POST /user/repos': () => json({ default_branch: 'main' }),
            }),
        )
        expect(await c.ensureRepo('kb')).toEqual({
            owner: 'ann',
            name: 'kb',
            defaultBranch: 'main',
        })
    })

    it('commitFiles walks ref → commit → tree → commit → ref', async () => {
        const fetchImpl = router({
            'GET /repos/ann/kb/git/ref/heads/main': () =>
                json({ object: { sha: 'base' } }),
            'GET /repos/ann/kb/git/commits/base': () =>
                json({ tree: { sha: 'basetree' } }),
            'POST /repos/ann/kb/git/trees': () => json({ sha: 'newtree' }),
            'POST /repos/ann/kb/git/commits': () => json({ sha: 'newcommit' }),
            'PATCH /repos/ann/kb/git/refs/heads/main': () => json({}),
        })
        const c = createGithubBuildClient('tok', fetchImpl)
        const out = await c.commitFiles(
            'ann',
            'kb',
            'main',
            [{ path: 'README.md', content: 'hi' }],
            'msg',
        )
        expect(out).toEqual({ commitSha: 'newcommit' })
        // the tree POST carries inline file content
        const treeCall = (
            fetchImpl as unknown as ReturnType<typeof vi.fn>
        ).mock.calls.find((c2) => String(c2[0]).endsWith('/git/trees'))!
        const body = JSON.parse(treeCall[1].body)
        expect(body.base_tree).toBe('basetree')
        expect(body.tree[0]).toMatchObject({
            path: 'README.md',
            content: 'hi',
            type: 'blob',
        })
    })

    it('getLatestRun maps the newest run (or null)', async () => {
        const c = createGithubBuildClient(
            'tok',
            router({
                'GET /repos/ann/kb/actions/runs?per_page=1': () =>
                    json({
                        workflow_runs: [
                            {
                                id: 7,
                                status: 'completed',
                                conclusion: 'success',
                                html_url: 'http://run/7',
                            },
                        ],
                    }),
            }),
        )
        expect(await c.getLatestRun('ann', 'kb')).toEqual({
            id: 7,
            status: 'completed',
            conclusion: 'success',
            htmlUrl: 'http://run/7',
        })
    })

    it('listArtifacts maps archive_download_url', async () => {
        const c = createGithubBuildClient(
            'tok',
            router({
                'GET /repos/ann/kb/actions/runs/7/artifacts': () =>
                    json({
                        artifacts: [
                            {
                                id: 3,
                                name: 'firmware',
                                archive_download_url: 'http://dl/3',
                            },
                        ],
                    }),
            }),
        )
        expect(await c.listArtifacts('ann', 'kb', 7)).toEqual([
            { id: 3, name: 'firmware', archiveDownloadUrl: 'http://dl/3' },
        ])
    })

    it('surfaces API errors with status + detail', async () => {
        const c = createGithubBuildClient(
            'tok',
            router({
                'GET /user': () => json({ message: 'Bad creds' }, false, 401),
            }),
        )
        await expect(c.getUser()).rejects.toThrow(/401/)
    })
})
