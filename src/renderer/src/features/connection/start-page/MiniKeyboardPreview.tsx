// Pattern check: no GoF pattern (-) — rejected — presentational mapper from cached PreviewKey[]
// (or a generic fallback board) to PhysicalLayoutCanvas positions; no abstraction.
import {
    PhysicalLayoutCanvas,
    type KeyPosition,
} from '@/features/keymap/keyboard/PhysicalLayoutCanvas'
import type { KeyCategory } from '@/lib/keymap/keyCategory'
import type { PreviewKey } from '@/stores/devicePreviewStore'

// A generic split-ish 3×5 cluster used purely as a visual flourish when no real
// layout has been cached yet (device never connected).
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

function toPositions(keys: PreviewKey[]): KeyPosition[] {
    return keys.map((k, i) => ({
        id: `prev-${i}`,
        x: k.x,
        y: k.y,
        width: k.width,
        height: k.height,
        r: k.r,
        rx: k.rx,
        ry: k.ry,
        category: k.category,
        holdTap: k.hold
            ? {
                  tap: <span>{k.tap}</span>,
                  hold: <span>{k.hold}</span>,
              }
            : undefined,
        children: k.hold ? undefined : <span>{k.tap}</span>,
    }))
}

interface MiniKeyboardPreviewProps {
    /** Cached real base-layer keys; when omitted a generic board is drawn. */
    keys?: PreviewKey[]
    oneU?: number
}

export function MiniKeyboardPreview({
    keys,
    oneU = 14,
}: MiniKeyboardPreviewProps): JSX.Element {
    const positions =
        keys && keys.length > 0 ? toPositions(keys) : MINI_POSITIONS
    return (
        <div
            className="pointer-events-none leading-[0]"
            style={{
                maskImage:
                    'radial-gradient(130% 130% at 50% 50%, #000 72%, transparent)',
                WebkitMaskImage:
                    'radial-gradient(130% 130% at 50% 50%, #000 72%, transparent)',
            }}
        >
            <PhysicalLayoutCanvas
                positions={positions}
                oneU={oneU}
                hoverZoom={false}
                capStyleOverride="sculpted"
                colorModeOverride="subtle"
                showHeaderTag={false}
                showCategoryDot={false}
            />
        </div>
    )
}
