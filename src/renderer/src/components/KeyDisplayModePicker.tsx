// Pattern check: no GoF pattern (-) — rejected — simple Select-based two-option picker, no abstraction warranted.
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

export function KeyDisplayModePicker(): JSX.Element {
    const mode = useUserSettingsStore((s) => s.keyDisplayMode)
    const setMode = useUserSettingsStore((s) => s.setKeyDisplayMode)

    return (
        <Select
            value={mode}
            onValueChange={(v) => setMode(v as KeyDisplayMode)}
        >
            <SelectTrigger className="w-48">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="displayName">Behavior name</SelectItem>
                <SelectItem value="binding">Binding code</SelectItem>
            </SelectContent>
        </Select>
    )
}
