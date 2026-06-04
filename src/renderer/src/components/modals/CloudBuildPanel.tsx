// Pattern check: no GoF pattern (-) — rejected — async container driving the
// GitHub build client through local UI state; state plumbing, no abstraction.
//
// Phase-1 cloud convenience: push the generated project bundle to the user's own
// GitHub repo (their Actions minutes, they own the artifact), poll the run, then
// download the built firmware. The zero-dep "Download .zip" path stays the
// fallback; this just automates push → build → fetch with a personal token.
import { useEffect, useState } from 'react'
import { Cloud, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
    buildProjectBundle,
    type ConfigKeymap,
    type Target,
} from '@firmware/config'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { downloadExports } from '@/lib/blob'
import { createGithubBuildClient } from '@/lib/githubBuild'
import { GITHUB_TOKEN_KEY, getSecret, setSecret } from '@/lib/secretStore'
import { createLogger } from '@shared/logger'

const log = createLogger('CloudBuild')

const POLL_INTERVAL_MS = 5000
const MAX_POLLS = 60 // ~5 min
const sleep = (ms: number): Promise<void> =>
    new Promise((r) => setTimeout(r, ms))

type Phase = 'idle' | 'pushing' | 'building' | 'ready' | 'error'

interface CloudBuildPanelProps {
    config: ConfigKeymap
    target: Target
}

export function CloudBuildPanel({
    config,
    target,
}: CloudBuildPanelProps): JSX.Element {
    const [token, setToken] = useState('')
    // Load the stored token asynchronously (safeStorage IPC on desktop).
    useEffect(() => {
        let live = true
        getSecret(GITHUB_TOKEN_KEY).then((t) => {
            if (live && t) setToken(t)
        })
        return () => {
            live = false
        }
    }, [])
    const defaultRepo = buildProjectBundle(config, target).rootName
    const [repo, setRepo] = useState(defaultRepo)
    const [phase, setPhase] = useState<Phase>('idle')
    const [message, setMessage] = useState('')
    const [runUrl, setRunUrl] = useState<string | null>(null)
    const [artifactUrl, setArtifactUrl] = useState<string | null>(null)

    const busy = phase === 'pushing' || phase === 'building'

    const run = async (): Promise<void> => {
        if (!token) {
            toast.error('Enter a GitHub token first')
            return
        }
        await setSecret(GITHUB_TOKEN_KEY, token)
        setArtifactUrl(null)
        setRunUrl(null)
        const client = createGithubBuildClient(token)
        const bundle = buildProjectBundle(config, target)
        try {
            setPhase('pushing')
            setMessage('Creating / opening repository…')
            const { owner, name, defaultBranch } = await client.ensureRepo(repo)
            setMessage('Pushing project files…')
            const { commitSha } = await client.commitFiles(
                owner,
                name,
                defaultBranch,
                bundle.files.map((f) => ({
                    path: f.filename,
                    content:
                        typeof f.content === 'string'
                            ? f.content
                            : new TextDecoder().decode(f.content),
                })),
                'remappr: update firmware config',
            )

            setPhase('building')
            setMessage('Waiting for the build to start…')
            await sleep(POLL_INTERVAL_MS) // let Actions register the push
            for (let i = 0; i < MAX_POLLS; i++) {
                // Scope polling to the commit we just pushed so a stale prior
                // run can't be mistaken for this build's result.
                const r = await client.getLatestRun(owner, name, commitSha)
                if (r) {
                    setRunUrl(r.htmlUrl)
                    if (r.status === 'completed') {
                        if (r.conclusion !== 'success') {
                            setPhase('error')
                            setMessage(
                                `Build ${r.conclusion ?? 'failed'} — see the run log.`,
                            )
                            return
                        }
                        const artifacts = await client.listArtifacts(
                            owner,
                            name,
                            r.id,
                        )
                        const fw = artifacts[0]
                        if (!fw) {
                            setPhase('error')
                            setMessage(
                                'Build succeeded but produced no artifact.',
                            )
                            return
                        }
                        setArtifactUrl(fw.archiveDownloadUrl)
                        setPhase('ready')
                        setMessage('Firmware built.')
                        return
                    }
                    setMessage(`Building… (${r.status})`)
                }
                await sleep(POLL_INTERVAL_MS)
            }
            setPhase('error')
            setMessage(
                'Timed out waiting for the build. Check Actions directly.',
            )
        } catch (e) {
            log.error('cloud build failed', e)
            setPhase('error')
            setMessage(e instanceof Error ? e.message : String(e))
        }
    }

    const downloadFirmware = async (): Promise<void> => {
        if (!artifactUrl) return
        try {
            const bytes =
                await createGithubBuildClient(token).downloadArtifact(
                    artifactUrl,
                )
            downloadExports([
                {
                    filename: `${repo}-firmware.zip`,
                    mime: 'application/zip',
                    content: bytes,
                },
            ])
            toast.success('Firmware downloaded')
        } catch (e) {
            log.error('artifact download failed', e)
            toast.error('Failed to download firmware')
        }
    }

    return (
        <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Build in the cloud (GitHub)
            </p>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label htmlFor="gh-token">Personal access token</Label>
                    <Input
                        id="gh-token"
                        type="password"
                        placeholder="ghp_…  (repo + workflow scope)"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        disabled={busy}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="gh-repo">Repository</Label>
                    <Input
                        id="gh-repo"
                        value={repo}
                        onChange={(e) => setRepo(e.target.value)}
                        disabled={busy}
                    />
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    onClick={run}
                    disabled={busy || !token}
                    className="flex items-center gap-2"
                >
                    {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Cloud className="h-4 w-4" />
                    )}
                    Push &amp; build
                </Button>
                {phase === 'ready' && (
                    <Button
                        onClick={downloadFirmware}
                        variant="outline"
                        className="flex items-center gap-2"
                    >
                        Download firmware (.zip)
                    </Button>
                )}
                {runUrl && (
                    <a
                        href={runUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
                    >
                        View run <ExternalLink className="h-3 w-3" />
                    </a>
                )}
            </div>
            {message && (
                <p
                    data-phase={phase}
                    className="text-xs text-muted-foreground data-[phase=error]:text-destructive"
                >
                    {message}
                </p>
            )}
            <p className="text-[11px] text-muted-foreground">
                The token is stored locally on this machine and used only to
                push to your repo and read the build. A fine-grained token with
                Contents + Actions access to that repo is enough.
            </p>
        </div>
    )
}
