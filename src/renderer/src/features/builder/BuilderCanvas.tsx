// Pattern check: no GoF pattern (-) — rejected — presentational canvas that maps
// the config's CanonGeometry[] to PhysicalLayoutCanvas KeyPosition[]; data plumbing.
//
// Phase-1 skeleton: a read-only, pannable view of the board geometry rendered
// through the production `KeyButton` (so caps inherit the theme + cap-style +
// category system for free). Click selects a single key (highlight only). The
// rich editing layer — marquee, multi-drag, resize/rotate handles, matrix
// overlay, fine snap — lands in Phase 3, replacing the internals here while
// keeping this component's external contract.
import { useMemo } from 'react'
import {
    PhysicalLayoutCanvas,
    type KeyPosition,
} from '@/features/keymap/keyboard/PhysicalLayoutCanvas'
import useConfigStore from '@/stores/configStore'
import useBuilderStore from '@/stores/builderStore'

export function BuilderCanvas(): JSX.Element {
    const config = useConfigStore((s) => s.config)
    const selection = useBuilderStore((s) => s.selection)
    const setSelection = useBuilderStore((s) => s.setSelection)

    const positions = useMemo<KeyPosition[]>(() => {
        if (!config) return []
        return config.keyboard.keys.map((k, i) => ({
            id: String(i),
            x: k.x,
            y: k.y,
            width: k.w,
            height: k.h,
            r: k.r,
            rx: k.rx,
            ry: k.ry,
        }))
    }, [config])

    const single = selection.size === 1 ? [...selection][0] : undefined

    return (
        <PhysicalLayoutCanvas
            positions={positions}
            pannable
            selectedPosition={single}
            selectedPositions={selection}
            onPositionClicked={(i) => setSelection(new Set([i]))}
        />
    )
}
