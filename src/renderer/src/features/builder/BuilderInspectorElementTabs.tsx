// pattern-check: skip presentational element switcher, no logic
import {
    Keyboard as KeyboardIcon,
    RotateCw,
    SlidersHorizontal,
} from 'lucide-react'
import { MiniLabel } from './MiniLabel'

/** Element-type switcher (key / encoder / slider) at the top of the inspector. */
export function ElementTabs({
    element,
    onSelect,
}: {
    element: 'key' | 'encoder' | 'slider'
    onSelect: (el: 'key' | 'encoder' | 'slider') => void
}): JSX.Element {
    const tabs: Array<['key' | 'encoder' | 'slider', string, React.ReactNode]> =
        [
            ['key', 'Key', <KeyboardIcon key="k" size={14} />],
            ['encoder', 'Encoder', <RotateCw key="e" size={14} />],
            ['slider', 'Slider', <SlidersHorizontal key="s" size={14} />],
        ]
    return (
        <div>
            <MiniLabel>Element</MiniLabel>
            <div className="grid grid-cols-3 gap-1.5">
                {tabs.map(([el, lbl, icon]) => {
                    const on = element === el
                    return (
                        <button
                            key={el}
                            type="button"
                            onClick={() => onSelect(el)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[12px] font-semibold text-foreground transition-colors"
                            style={{
                                background: on
                                    ? 'color-mix(in oklch, var(--primary) 16%, var(--background))'
                                    : 'var(--background)',
                                borderColor: on
                                    ? 'var(--primary)'
                                    : 'var(--border)',
                            }}
                        >
                            {icon} {lbl}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
