// Pattern check: no GoF pattern (-) — rejected — presentational QMK config.h /
// rules.mk override editor + previews; setFirmwareConfig writer passed in, no abstraction.
import type { CanonFirmwareConfig, ConfigKeymap } from '@firmware/config'
import { deriveQmkConfigH, deriveQmkRulesMk } from '@firmware/config'
import { MiniLabel } from '../MiniLabel'
import { FilePreview, TextArea } from '../builderFormControls'

export function QmkConfigSection({
    config,
    fc,
    targets,
    setFirmwareConfig,
}: {
    config: ConfigKeymap
    fc: CanonFirmwareConfig
    targets: string[]
    setFirmwareConfig: (p: Partial<CanonFirmwareConfig>) => void
}): JSX.Element {
    return (
        <div>
            <MiniLabel>Firmware config (config.h / rules.mk)</MiniLabel>
            <div className="flex flex-col gap-2">
                <div>
                    <MiniLabel>Extra config.h</MiniLabel>
                    <TextArea
                        value={fc.configH ?? ''}
                        placeholder="#define TAPPING_TERM 180"
                        onCommit={(v) =>
                            setFirmwareConfig({
                                configH: v.trim() || undefined,
                            })
                        }
                    />
                </div>
                <div>
                    <MiniLabel>Extra rules.mk</MiniLabel>
                    <TextArea
                        value={fc.rulesMk ?? ''}
                        placeholder="MOUSEKEY_ENABLE = yes"
                        rows={3}
                        onCommit={(v) =>
                            setFirmwareConfig({
                                rulesMk: v.trim() || undefined,
                            })
                        }
                    />
                </div>
                <div>
                    <MiniLabel>Generated config.h</MiniLabel>
                    <FilePreview text={deriveQmkConfigH(config)} />
                </div>
                <div>
                    <MiniLabel>Generated rules.mk</MiniLabel>
                    <FilePreview
                        text={deriveQmkRulesMk(
                            config,
                            targets.some((f) => f === 'via' || f === 'vial'),
                            targets.includes('vial'),
                        )}
                    />
                </div>
            </div>
        </div>
    )
}
