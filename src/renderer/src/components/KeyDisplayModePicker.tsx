// Pattern check: no GoF pattern (-) — rejected — simple Select-based two-option picker, no abstraction warranted.
// pattern-check: skip — read scoped per-firmware setting from store
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'
import useUserSettingsStore, {
    type KeyDisplayMode,
} from '@/stores/userSettingsStore'
import useConnectionStore from '@/stores/connectionStore'

export function KeyDisplayModePicker(): JSX.Element {
    const firmware = useConnectionStore((s) => s.service?.deviceInfo.firmware)
    const mode = useUserSettingsStore((s) => s.getKeyDisplayMode(firmware))
    const setMode = useUserSettingsStore((s) => s.setKeyDisplayMode)

    return (
        <Select
            value={mode}
            onValueChange={(v) => setMode(firmware, v as KeyDisplayMode)}
        >
            <SelectTrigger className="w-48">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="displayName">Action name</SelectItem>
                <SelectItem value="binding">Binding code</SelectItem>
            </SelectContent>
        </Select>
    )
}
