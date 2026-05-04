// pattern-check: skip — single inline span for version display
import {Separator} from '@/ui/separator'
import {APP_VERSION} from '@/lib/constants'

export function Footer (): JSX.Element {
    return (
        <>
            <Separator className="data-[orientation=vertical]:h-4" />
            <div
                className="flex h-(--footer-height) shrink-0 items-center gap-2 transition-[width,height] ease-linear justify-center">
                <span>
                    &copy; {new Date().getFullYear()} - Remappr Contributors
                </span>
                <span className="text-xs opacity-60">v{APP_VERSION}</span>
            </div>
        </>
    )
}
