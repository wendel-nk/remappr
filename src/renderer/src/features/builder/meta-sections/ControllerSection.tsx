// Pattern check: no GoF pattern (-) — rejected — presentational firmware-gated
// controller fields; setController writer + show flags passed in, no abstraction.
import { KNOWN_ZMK_BOARDS } from '@firmware/config'
import type { CanonController, ConfigKeyboard } from '@firmware/config'
import { MiniLabel } from '../MiniLabel'
import { TextField } from '../builderFormControls'

export function ControllerSection({
    ctrl,
    hardware,
    showZmkCtrl,
    showQmkCtrl,
    setController,
}: {
    ctrl: CanonController | undefined
    hardware: ConfigKeyboard['hardware']
    showZmkCtrl: boolean
    showQmkCtrl: boolean
    setController: (p: Partial<CanonController>) => void
}): JSX.Element {
    return (
        <div>
            <MiniLabel>Controller</MiniLabel>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <div className="mb-1 text-[11px] text-muted-foreground">
                        Board
                    </div>
                    <TextField
                        mono
                        list="zmk-boards"
                        value={ctrl?.board ?? hardware?.board ?? ''}
                        onCommit={(v) =>
                            setController({ board: v.trim() || undefined })
                        }
                        placeholder="nice_nano_v2"
                    />
                    <datalist id="zmk-boards">
                        {KNOWN_ZMK_BOARDS.map((b) => (
                            <option key={b} value={b} />
                        ))}
                    </datalist>
                </div>
                {/* firmware-gated fields — // pattern-check: skip presentational */}
                {showZmkCtrl && (
                    <div>
                        <div className="mb-1 text-[11px] text-muted-foreground">
                            Shield (opt.)
                        </div>
                        <TextField
                            mono
                            value={ctrl?.shield ?? hardware?.shield ?? ''}
                            onCommit={(v) =>
                                setController({
                                    shield: v.trim() || undefined,
                                })
                            }
                            placeholder="corne_left"
                        />
                    </div>
                )}
                {showQmkCtrl && (
                    <div>
                        <div className="mb-1 text-[11px] text-muted-foreground">
                            Processor (QMK)
                        </div>
                        <TextField
                            mono
                            value={ctrl?.processor ?? ''}
                            onCommit={(v) =>
                                setController({
                                    processor: v.trim() || undefined,
                                })
                            }
                            placeholder="atmega32u4"
                        />
                    </div>
                )}
                {showQmkCtrl && (
                    <div>
                        <div className="mb-1 text-[11px] text-muted-foreground">
                            Bootloader (QMK)
                        </div>
                        <TextField
                            mono
                            value={ctrl?.bootloader ?? ''}
                            onCommit={(v) =>
                                setController({
                                    bootloader: v.trim() || undefined,
                                })
                            }
                            placeholder="atmel-dfu"
                        />
                    </div>
                )}
                {showQmkCtrl && (
                    <div>
                        <div className="mb-1 text-[11px] text-muted-foreground">
                            Dev board (QMK)
                        </div>
                        <TextField
                            mono
                            value={ctrl?.developmentBoard ?? ''}
                            onCommit={(v) =>
                                setController({
                                    developmentBoard: v.trim() || undefined,
                                })
                            }
                            placeholder="promicro"
                        />
                    </div>
                )}
                {showQmkCtrl && (
                    <div>
                        <div className="mb-1 text-[11px] text-muted-foreground">
                            Device version
                        </div>
                        <TextField
                            mono
                            value={ctrl?.deviceVersion ?? ''}
                            onCommit={(v) =>
                                setController({
                                    deviceVersion: v.trim() || undefined,
                                })
                            }
                            placeholder="1.0.0"
                        />
                    </div>
                )}
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                {showZmkCtrl && !showQmkCtrl
                    ? 'ZMK uses board + optional shield. Lets remappr emit a flashable project.'
                    : showQmkCtrl && !showZmkCtrl
                      ? 'QMK uses processor + bootloader (or a dev-board shortcut) + USB device version.'
                      : 'ZMK uses board (+ shield); QMK uses processor + bootloader (or a dev-board shortcut).'}
            </p>
        </div>
    )
}
