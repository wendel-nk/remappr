// pattern-check: skip — composes BytesEditor for regions + effect bytes
import { useCallback, useEffect, useState } from 'react'

import type { RgbApi } from '@firmware/service'
import { saveWithToast } from '@/lib/saveWithToast'

import { BytesEditor } from './BytesEditor'

interface Props {
    rgb: RgbApi
}

export function MixedPanel({ rgb }: Props): JSX.Element {
    const [regions, setRegions] = useState<Uint8Array>(new Uint8Array())
    const [effect, setEffect] = useState<Uint8Array>(new Uint8Array())

    const reloadRegions = useCallback(async () => {
        if (!rgb.getMixedRegions) return
        const r = await saveWithToast(
            () => rgb.getMixedRegions!(),
            null,
            'Regions read failed',
        )
        if (r) setRegions(r)
    }, [rgb])

    const reloadEffect = useCallback(async () => {
        if (!rgb.getMixedEffect) return
        const r = await saveWithToast(
            () => rgb.getMixedEffect!(),
            null,
            'Effect read failed',
        )
        if (r) setEffect(r)
    }, [rgb])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void reloadRegions()
        void reloadEffect()
    }, [reloadRegions, reloadEffect])

    if (!rgb.getMixedRegions || !rgb.setMixedRegions) {
        return (
            <div className="text-xs text-muted-foreground">
                Mixed-effect not exposed by this firmware build.
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <BytesEditor
                label="Regions"
                bytes={regions}
                onChange={setRegions}
                onReload={reloadRegions}
                onWrite={async (): Promise<void> => {
                    if (!rgb.setMixedRegions) return
                    await saveWithToast(
                        () => rgb.setMixedRegions!(regions),
                        'Regions written',
                        'Regions write failed',
                    )
                }}
            />
            {rgb.getMixedEffect && rgb.setMixedEffect && (
                <BytesEditor
                    label="Effect"
                    bytes={effect}
                    onChange={setEffect}
                    onReload={reloadEffect}
                    onWrite={async (): Promise<void> => {
                        if (!rgb.setMixedEffect) return
                        await saveWithToast(
                            () => rgb.setMixedEffect!(effect),
                            'Effect written',
                            'Effect write failed',
                        )
                    }}
                />
            )}
        </div>
    )
}
