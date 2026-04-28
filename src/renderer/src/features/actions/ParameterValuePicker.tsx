// Pattern check: no GoF pattern (-) — rejected — added optional highlightedKeys prop pass-through, no abstraction warranted.
import { BehaviorParameterValueDescription } from '@firmware/zmk'
import { KeycodePickerGrid } from '@/features/keymap/keycode-picker/KeycodePickerGrid'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/ui/select'
import { Label } from '@/ui/label'
import { Input } from '@/ui/input'

export interface ParameterValuePickerProps {
    value?: number
    values: BehaviorParameterValueDescription[]
    layers: { id: number; name: string }[]
    highlightedKeys?: number[]
    onValueChanged: (value?: number) => void
}

const ConstantValuePicker = ({
    value,
    values,
    onValueChanged,
}: ParameterValuePickerProps): JSX.Element => (
    <>
        {/*<Label htmlFor="constantValuePicker">Select value</Label>*/}
        <Select
            onValueChange={(e) => {
                console.log(e)
                onValueChanged(parseInt(e))
            }}
            value={value?.toString()}
        >
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Constant Value Picker" />
            </SelectTrigger>
            <SelectContent>
                {values.map((v) =>
                    v.constant !== undefined ? (
                        <SelectItem
                            key={v.constant}
                            value={v.constant.toString()}
                        >
                            {v.name}
                        </SelectItem>
                    ) : null,
                )}
            </SelectContent>
        </Select>
    </>
)

const RangeValuePicker = ({
    value,
    values,
    onValueChanged,
}: ParameterValuePickerProps): JSX.Element => (
    <>
        <Label htmlFor="rangeValuePicker">{values[0].name}: </Label>
        <Input
            id="rangeValuePicker"
            type="number"
            min={values[0].range?.min}
            max={values[0].range?.max}
            value={value}
            onChange={(e) => onValueChanged(parseInt(e.target.value))}
        />
    </>
)

const LayerValuePicker = ({
    value,
    values,
    layers,
    onValueChanged,
}: ParameterValuePickerProps): JSX.Element => (
    <>
        <Label htmlFor="layerValuePicker">{values[0].name}:</Label>
        <Select
            onValueChange={(e) => onValueChanged(parseInt(e))}
            value={value?.toString()}
        >
            <SelectTrigger id="layerValuePicker" className="w-[180px]">
                <SelectValue placeholder="Constant Value Picker" />
            </SelectTrigger>
            <SelectContent>
                {layers.map(({ id, name }) => (
                    <SelectItem key={id} value={id.toString()}>
                        {name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    </>
)

export const ParameterValuePicker = ({
    value,
    values,
    layers,
    highlightedKeys,
    onValueChanged,
}: ParameterValuePickerProps): JSX.Element | null => {
    if (values.length === 0) {
        return null
    }

    if (values.every((v) => v.constant !== undefined)) {
        return (
            <ConstantValuePicker
                value={value}
                values={values}
                onValueChanged={onValueChanged}
                layers={layers}
            />
        )
    }

    if (values.length === 1) {
        if (values[0].range) {
            return (
                <RangeValuePicker
                    value={value}
                    values={values}
                    onValueChanged={onValueChanged}
                    layers={layers}
                />
            )
        }

        if (values[0].hidUsage) {
            return (
                <KeycodePickerGrid
                    onValueChanged={onValueChanged}
                    label={values[0].name}
                    value={value}
                    highlightedKeys={highlightedKeys}
                />
            )
        }

        if (values[0].layerId) {
            return (
                <LayerValuePicker
                    value={value}
                    values={values}
                    onValueChanged={onValueChanged}
                    layers={layers}
                />
            )
        }
    }

    return <p>Unsupported parameter configuration.</p>
}
