// Pattern check: no GoF pattern (-) — rejected — single-toggle capabilities
// section; patchKeyboard writer passed in, no abstraction.
import type { ConfigKeyboard } from '@firmware/config'
import { MiniLabel } from '../MiniLabel'
import { ToggleRow } from '../builderFormControls'

export function CapabilitiesSection({
    split,
    patchKeyboard,
}: {
    split: boolean
    patchKeyboard: (p: Partial<ConfigKeyboard>) => void
}): JSX.Element {
    return (
        <div>
            <MiniLabel>Capabilities</MiniLabel>
            <ToggleRow
                on={split}
                onToggle={(v) => patchKeyboard({ split: v || undefined })}
                label="Split / two-piece"
            />
        </div>
    )
}
