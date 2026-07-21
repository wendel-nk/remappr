// pattern-check: skip — presentational tab-strip over a section config list, no abstraction
import type { RgbSheetSection } from '@/stores/rgbSheetStore'
import { cn } from '@/lib/cn'
import type { SECTIONS } from './rgbSheetSections'

export function RgbSheetNav({
    activeSection,
    setSection,
    sections,
}: {
    activeSection: RgbSheetSection
    setSection: (id: RgbSheetSection) => void
    sections: typeof SECTIONS
}): JSX.Element {
    return (
        <nav className="flex flex-wrap gap-1">
            {sections.map(({ id, label, icon: Icon }) => (
                <button
                    key={id}
                    type="button"
                    onClick={(): void => setSection(id)}
                    aria-current={activeSection === id ? 'page' : undefined}
                    className={cn(
                        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                        activeSection === id
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                    )}
                >
                    <Icon className="size-4 shrink-0" />
                    {label}
                </button>
            ))}
        </nav>
    )
}
