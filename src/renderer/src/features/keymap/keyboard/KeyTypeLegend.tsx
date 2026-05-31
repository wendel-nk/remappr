// Pattern check: no GoF pattern (-) — rejected — presentational legend mapping hued key
// categories to colour dots via catStyle; pure rendering, no abstraction warranted.
import {
    catStyle,
    CATEGORY_META,
    type KeyCategory,
} from '@/lib/keymap/keyCategory'
import { SidebarGroupContent, SidebarGroupLabel } from '@/ui/sidebar'

// Curated, ordered subset of the hued categories (neutral alpha/space/trans omitted).
const LEGEND_CATEGORIES: KeyCategory[] = [
    'mod',
    'layer',
    'nav',
    'edit',
    'num',
    'punct',
    'media',
    'mouse',
    'system',
]

export function KeyTypeLegend(): JSX.Element {
    return (
        <>
            <SidebarGroupLabel>Key types</SidebarGroupLabel>
            <SidebarGroupContent>
                <ul className="grid grid-cols-2 gap-x-2 gap-y-1 px-2 py-1 group-data-[collapsible=icon]:hidden">
                    {LEGEND_CATEGORIES.map((cat) => {
                        const dot = catStyle(cat, 'vivid').dot
                        return (
                            <li
                                key={cat}
                                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                            >
                                <span
                                    aria-hidden
                                    className="size-2 shrink-0 rounded-full"
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
