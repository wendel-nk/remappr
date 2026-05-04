// pattern-check: skip — thin component consuming the github.ts Facade
import {useEffect, useState} from 'react'
import {Download, ExternalLink} from 'lucide-react'
import {Button} from '@/ui/button'
import {
    detectPlatform,
    getAssetForPlatform,
    getLatestRelease,
    getPlatformLabel,
    type Release,
    type ReleaseAsset,
} from '@/lib/github'
import {REPO_URL} from '@/lib/constants'

interface Props {
    className?: string
    variant?: 'default' | 'outline' | 'ghost' | 'secondary'
}

function formatBytes ( bytes: number ): string {
    if ( bytes < 1024 ) return `${bytes} B`
    if ( bytes < 1024 * 1024 ) return `${(bytes / 1024).toFixed( 0 )} KB`
    if ( bytes < 1024 * 1024 * 1024 )
        return `${(bytes / 1024 / 1024).toFixed( 1 )} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed( 2 )} GB`
}

export function DownloadLatestButton ( {
    className,
    variant = 'outline',
}: Props ): JSX.Element {
    const [release, setRelease] = useState<Release | null>( null )
    const [asset, setAsset] = useState<ReleaseAsset | null>( null )
    const [loading, setLoading] = useState( true )
    const platform = detectPlatform()
    const platformLabel = getPlatformLabel( platform )

    useEffect( () => {
        let cancelled = false
        getLatestRelease()
            .then( ( rel ) => {
                if ( cancelled ) return
                setRelease( rel )
                if ( rel ) setAsset( getAssetForPlatform( rel, platform ) )
            } )
            .finally( () => {
                if ( !cancelled ) setLoading( false )
            } )
        return () => {
            cancelled = true
        }
    }, [platform] )

    if ( loading ) {
        return (
            <Button variant={variant} className={className} disabled>
                <Download className="mr-2 h-4 w-4" />
                Checking latest release…
            </Button>
        )
    }

    if ( !release ) {
        return (
            <Button
                variant={variant}
                className={className}
                onClick={() => window.open( `${REPO_URL}/releases`, '_blank' )}
            >
                <ExternalLink className="mr-2 h-4 w-4" />
                View releases
            </Button>
        )
    }

    if ( !asset ) {
        return (
            <Button
                variant={variant}
                className={className}
                onClick={() => window.open( release.html_url, '_blank' )}
            >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open {release.tag_name} release page
            </Button>
        )
    }

    return (
        <Button
            variant={variant}
            className={className}
            onClick={() => window.open( asset.browser_download_url, '_blank' )}
        >
            <Download className="mr-2 h-4 w-4" />
            Download {release.tag_name} for {platformLabel}
            {asset.size > 0 ? ` (${formatBytes( asset.size )})` : ''}
        </Button>
    )
}
