import { Separator } from '@/ui/separator.tsx'

export function Footer(): JSX.Element {
    return (
        <>
            <Separator className="data-[orientation=vertical]:h-4" />
            <div className="flex h-(--footer-height) shrink-0 items-center gap-2 transition-[width,height] ease-linear justify-center">
                <span>
                    &copy; {new Date().getFullYear()} - Remappr Contributors
                </span>
            </div>
        </>
    )
}
