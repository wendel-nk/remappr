// Pattern check: no GoF pattern (-) — rejected — presentational identity + USB
// form fields; writers (patchName/patchMeta) are passed in, no abstraction.
import type { ConfigMeta } from '@firmware/config'
import { MiniLabel } from '../MiniLabel'
import { TextField } from '../builderFormControls'

export function IdentitySection({
    meta,
    patchName,
    patchMeta,
}: {
    meta: ConfigMeta
    patchName: (v: string) => void
    patchMeta: (p: Partial<ConfigMeta>) => void
}): JSX.Element {
    return (
        <>
            {/* Identity */}
            <div>
                <MiniLabel>Identity</MiniLabel>
                <div className="flex flex-col gap-2">
                    <TextField
                        value={meta.name}
                        onCommit={patchName}
                        placeholder="Keyboard name"
                    />
                    <TextField
                        value={meta.author ?? ''}
                        onCommit={(v) => patchMeta({ author: v || undefined })}
                        placeholder="Author / maintainer"
                    />
                </div>
            </div>

            {/* USB identifiers */}
            <div>
                <MiniLabel>USB identifiers</MiniLabel>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <div className="mb-1 text-[11px] text-muted-foreground">
                            Vendor ID
                        </div>
                        <TextField
                            mono
                            value={meta.vendorId ?? ''}
                            onCommit={(v) =>
                                patchMeta({ vendorId: v || undefined })
                            }
                            placeholder="0xFEED"
                        />
                    </div>
                    <div>
                        <div className="mb-1 text-[11px] text-muted-foreground">
                            Product ID
                        </div>
                        <TextField
                            mono
                            value={meta.productId ?? ''}
                            onCommit={(v) =>
                                patchMeta({ productId: v || undefined })
                            }
                            placeholder="0x0001"
                        />
                    </div>
                </div>
            </div>
        </>
    )
}
