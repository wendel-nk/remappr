// Pattern check: no GoF pattern (-) — rejected — presentational legend mapping hued key
// categories to colour dots via catStyle; pure rendering, no abstraction warranted.
import {
    catStyle,
    CATEGORY_META,
    type KeyCategory,
} from '@/lib/keymap/keyCategory'
import { SidebarGroupContent, SidebarGroupLabel } from '@/ui/sidebar'

// Curated, ordered subset of the hued categories (design legend = 6 chips).
const LEGEND_CATEGORIES: KeyCategory[] = [
    'mod',
    'layer',
    'nav',
    'edit',
    'num',
    'media',
]

export function KeyTypeLegend(): JSX.Element {
    return (
        <>
            <SidebarGroupLabel className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Key types
            </SidebarGroupLabel>
            <SidebarGroupContent>
                <ul className="flex flex-wrap gap-x-3 gap-y-1.5 px-2 py-1 group-data-[collapsible=icon]:hidden">
                    {LEGEND_CATEGORIES.map((cat) => {
                        const dot = catStyle(cat, 'vivid').dot
                        return (
                            <li
                                key={cat}
                                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                            >
                                <span
                                    aria-hidden
                                    className="size-2 shrink-0 rounded-[3px]"
                                    style={{ background: dot ?? undefined }}
                                />
                                {CATEGORY_META[cat].label}
                            </li>
                        )
                    })}
                </ul>
            </SidebarGroupContent>
        </>
    )
}
