// Pattern check: no GoF pattern (-) — rejected — decorative generic mini keyboard rendered
// through PhysicalLayoutCanvas at a small oneU; static positions, presentational only.
import {
    PhysicalLayoutCanvas,
    type KeyPosition,
} from '@/features/keymap/keyboard/PhysicalLayoutCanvas'
import type { KeyCategory } from '@/lib/keymap/keyCategory'

// A generic split-ish 3×5 cluster used purely as a visual flourish on device cards —
// it does not reflect the real device layout (unknown until connected).
const ROW_CATEGORIES: KeyCategory[][] = [
    ['num', 'alpha', 'alpha', 'alpha', 'nav'],
    ['mod', 'alpha', 'alpha', 'alpha', 'edit'],
    ['layer', 'alpha', 'alpha', 'punct', 'system'],
]

const MINI_POSITIONS: KeyPosition[] = ROW_CATEGORIES.flatMap((row, y) =>
    row.map((category, x) => ({
        id: `mini-${y}-${x}`,
        x,
        y,
        width: 1,
        height: 1,
        category,
    })),
)

export function MiniKeyboardPreview(): JSX.Element {
    return (
        <div className="pointer-events-none leading-[0]">
            <PhysicalLayoutCanvas
                positions={MINI_POSITIONS}
                oneU={14}
                hoverZoom={false}
            />
        </div>
    )
}
