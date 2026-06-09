// Pattern check: no GoF pattern (-) — rejected — presentational firmware-target
// picker grid + derived type banner; toggleTarget writer passed in, no abstraction.
import { Bluetooth, Check, Usb } from 'lucide-react'
import { BUILDER_FIRMWARE_TARGETS } from '@firmware/config'
import { MiniLabel } from '../MiniLabel'
import { keyboardTypeFor } from './constants'

export function FirmwareTargetsSection({
    targets,
    toggleTarget,
}: {
    targets: string[]
    toggleTarget: (id: string) => void
}): JSX.Element {
    const kt = keyboardTypeFor(targets)
    return (
        <div>
            <MiniLabel>Firmware targets</MiniLabel>
            <div className="grid grid-cols-2 gap-[7px]">
                {BUILDER_FIRMWARE_TARGETS.map((f) => {
                    const on = targets.includes(f.id)
                    return (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => toggleTarget(f.id)}
                            className="rounded-[9px] px-2.5 py-2 text-left text-foreground transition-colors"
                            style={{
                                background: on
                                    ? 'color-mix(in oklch, var(--primary) 16%, var(--background))'
                                    : 'var(--background)',
                                border: `1px solid ${on ? 'color-mix(in oklch, var(--primary) 50%, transparent)' : 'var(--border)'}`,
                            }}
                        >
                            <div className="flex items-center gap-1.5 text-[13px] font-bold">
                                {f.name}
                                {on && (
                                    <Check
                                        size={13}
                                        className="ml-auto text-primary"
                                    />
                                )}
                            </div>
                            <div className="mt-px text-[10.5px] text-muted-foreground">
                                {f.blurb}
                            </div>
                        </button>
                    )
                })}
            </div>
            <div
                className="mt-2 flex items-center gap-2 rounded-[9px] px-2.5 py-2"
                style={{
                    background:
                        'color-mix(in oklch, var(--primary) 7%, var(--background))',
                    border: '1px solid color-mix(in oklch, var(--primary) 22%, transparent)',
                }}
            >
                {kt.wireless ? (
                    <Bluetooth size={14} className="text-primary" />
                ) : (
                    <Usb size={14} className="text-primary" />
                )}
                <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-bold">
                        Keyboard type · {kt.conn}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground">
                        Keycodes &amp; behaviours follow {kt.label}
                    </div>
                </div>
            </div>
        </div>
    )
}
