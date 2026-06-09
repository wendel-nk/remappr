// Pattern check: no GoF pattern (-) — rejected — presentational ZMK .conf toggles
// + hardware-pin wiring (grouped, both ZMK-only); writers passed in, no abstraction.
import type {
    CanonFirmwareConfig,
    ConfigHardware,
    ConfigKeymap,
    ZmkConfFlags,
} from '@firmware/config'
import { deriveZmkConf } from '@firmware/config'
import { MiniLabel } from '../MiniLabel'
import {
    FilePreview,
    TextArea,
    TextField,
    ToggleRow,
} from '../builderFormControls'

// pattern-check: skip — swap hand-rolled alias for canonical ZmkConfFlags type
export function ZmkConfigSection({
    config,
    fc,
    zmkFlags,
    hw,
    setFirmwareConfig,
    setHardware,
    setExtPowerCtrl,
    setBacklightPwm,
    setWs2812,
}: {
    config: ConfigKeymap
    fc: CanonFirmwareConfig
    zmkFlags: ZmkConfFlags
    hw: ConfigHardware
    setFirmwareConfig: (p: Partial<CanonFirmwareConfig>) => void
    setHardware: (p: Partial<ConfigHardware>) => void
    setExtPowerCtrl: (
        p: Partial<NonNullable<ConfigHardware['extPowerCtrl']>> | null,
    ) => void
    setBacklightPwm: (
        p: Partial<NonNullable<ConfigHardware['backlightPwm']>> | null,
    ) => void
    setWs2812: (
        p: Partial<NonNullable<ConfigHardware['ws2812']>> | null,
    ) => void
}): JSX.Element {
    return (
        <>
            {/* Firmware config — ZMK .conf toggles + live preview + overrides */}
            <div>
                <MiniLabel>Firmware config (.conf)</MiniLabel>
                <div className="flex flex-col gap-1.5">
                    {(
                        [
                            ['usb', 'USB', zmkFlags.usb],
                            ['ble', 'Bluetooth (BLE)', zmkFlags.ble],
                            ['studio', 'ZMK Studio', zmkFlags.studio],
                            [
                                'studioUsbCdc',
                                'Studio over USB (CDC)',
                                zmkFlags.studioCdc,
                            ],
                            [
                                'studioLocking',
                                'Studio unlock required',
                                zmkFlags.studioLocking,
                            ],
                            ['softOff', 'Soft-off', zmkFlags.softOff],
                            ['extPower', 'External power', zmkFlags.extPower],
                            ['pointing', 'Pointing (mouse)', zmkFlags.pointing],
                            // Backlight + RGB underglow are driven by the
                            // Lighting section above (it sets the .conf flag).
                            ['usbLogging', 'USB logging', zmkFlags.usbLogging],
                        ] as [keyof CanonFirmwareConfig, string, boolean][]
                    ).map(([k, label, resolved]) => (
                        <ToggleRow
                            key={k}
                            label={label}
                            on={(fc[k] as boolean | undefined) ?? resolved}
                            onToggle={(v) =>
                                // Studio-CDC also drives the overlay endpoint node.
                                k === 'studioUsbCdc'
                                    ? (setFirmwareConfig({
                                          studioUsbCdc: v,
                                      }),
                                      setHardware({
                                          studioAcm: v || undefined,
                                      }))
                                    : setFirmwareConfig({ [k]: v })
                            }
                        />
                    ))}
                </div>
                <div className="mt-2">
                    <MiniLabel>Extra Kconfig</MiniLabel>
                    <TextArea
                        value={fc.kconfig ?? ''}
                        placeholder="CONFIG_ZMK_SLEEP=y"
                        onCommit={(v) =>
                            setFirmwareConfig({
                                kconfig: v.trim() || undefined,
                            })
                        }
                    />
                </div>
                <div className="mt-2">
                    <MiniLabel>Generated .conf</MiniLabel>
                    <FilePreview text={deriveZmkConf(config)} />
                </div>
            </div>

            {/* Hardware pins — full-parity ZMK peripheral wiring */}
            {(zmkFlags.extPower ||
                zmkFlags.backlight ||
                zmkFlags.underglow) && (
                <div>
                    <MiniLabel>Hardware pins</MiniLabel>
                    <div className="flex flex-col gap-2">
                        {zmkFlags.extPower && (
                            <div className="rounded-lg border border-border p-2.5">
                                <div className="mb-1.5 text-[11px] font-semibold text-foreground">
                                    Ext-power control GPIO
                                </div>
                                <TextField
                                    mono
                                    value={hw.extPowerCtrl?.controlGpio ?? ''}
                                    placeholder="P0.14"
                                    onCommit={(v) =>
                                        setExtPowerCtrl(
                                            v.trim()
                                                ? { controlGpio: v.trim() }
                                                : null,
                                        )
                                    }
                                />
                                <div className="mt-1.5">
                                    <ToggleRow
                                        label="Active low"
                                        on={!!hw.extPowerCtrl?.activeLow}
                                        onToggle={(v) =>
                                            setExtPowerCtrl({
                                                activeLow: v || undefined,
                                            })
                                        }
                                    />
                                </div>
                            </div>
                        )}
                        {zmkFlags.backlight && (
                            <div className="rounded-lg border border-border p-2.5">
                                <div className="mb-1.5 text-[11px] font-semibold text-foreground">
                                    Backlight PWM
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <TextField
                                        mono
                                        value={hw.backlightPwm?.pin ?? ''}
                                        placeholder="P0.13 (pin)"
                                        onCommit={(v) =>
                                            setBacklightPwm({
                                                pin: v.trim(),
                                            })
                                        }
                                    />
                                    <TextField
                                        mono
                                        value={hw.backlightPwm?.instance ?? ''}
                                        placeholder="pwm0"
                                        onCommit={(v) =>
                                            setBacklightPwm({
                                                instance: v.trim() || 'pwm0',
                                            })
                                        }
                                    />
                                </div>
                                <div className="mt-1.5">
                                    <ToggleRow
                                        label="Inverted (active-low LED)"
                                        on={!!hw.backlightPwm?.inverted}
                                        onToggle={(v) =>
                                            setBacklightPwm({
                                                inverted: v || undefined,
                                            })
                                        }
                                    />
                                </div>
                            </div>
                        )}
                        {zmkFlags.underglow && (
                            <div className="rounded-lg border border-border p-2.5">
                                <div className="mb-1.5 text-[11px] font-semibold text-foreground">
                                    WS2812 underglow
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <TextField
                                        mono
                                        value={hw.ws2812?.dataPin ?? ''}
                                        placeholder="P1.13 (data)"
                                        onCommit={(v) =>
                                            setWs2812({ dataPin: v.trim() })
                                        }
                                    />
                                    <TextField
                                        mono
                                        value={String(
                                            hw.ws2812?.chainLength ?? '',
                                        )}
                                        placeholder="LEDs"
                                        onCommit={(v) => {
                                            const n = Number(v)
                                            if (Number.isInteger(n) && n > 0)
                                                setWs2812({
                                                    chainLength: n,
                                                })
                                        }}
                                    />
                                </div>
                                <div className="mt-1.5 grid grid-cols-2 gap-2">
                                    <select
                                        value={hw.ws2812?.colorOrder ?? 'GRB'}
                                        onChange={(e) =>
                                            setWs2812({
                                                colorOrder: e.target
                                                    .value as NonNullable<
                                                    ConfigHardware['ws2812']
                                                >['colorOrder'],
                                            })
                                        }
                                        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 font-mono text-[12px] font-semibold text-foreground outline-none focus:border-primary"
                                    >
                                        {[
                                            'GRB',
                                            'RGB',
                                            'BGR',
                                            'RGBW',
                                            'GRBW',
                                        ].map((o) => (
                                            <option key={o} value={o}>
                                                {o}
                                            </option>
                                        ))}
                                    </select>
                                    <TextField
                                        mono
                                        value={hw.ws2812?.spi ?? ''}
                                        placeholder="spi3"
                                        onCommit={(v) =>
                                            setWs2812({
                                                spi: v.trim() || 'spi3',
                                            })
                                        }
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                        Pins like <span className="font-mono">P0.13</span> emit
                        nRF psels; verify against your board wiring.
                    </p>
                </div>
            )}
        </>
    )
}
