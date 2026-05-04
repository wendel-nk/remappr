// pattern-check: skip — file-picker UI glue around service.applyLayout
import { useCallback, useRef } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import useConnectionStore from '@/stores/connectionStore'
import useKeymapStore from '@/stores/keymapStore'
import { saveWithToast } from '@/lib/saveWithToast'
import {
    cacheKey,
    parseSideloadJson,
    saveCached,
} from '@firmware/qmk/layoutSideload'

export function LayoutSideloadAction(): JSX.Element | null {
    const service = useConnectionStore((s) => s.service)
    const setKeymap = useKeymapStore((s) => s.setKeymap)
    const inputRef = useRef<HTMLInputElement | null>(null)

    const onPick = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file || !service) return
            if (!service.applyLayout) {
                toast.error('This firmware does not support layout sideload')
                return
            }
            const name = await saveWithToast(
                async () => {
                    const text = await file.text()
                    const def = parseSideloadJson(text)
                    await service.applyLayout!(def)
                    const key = cacheKey(service.deviceInfo)
                    if (key) saveCached(key, def)
                    const km = await service.getKeymap()
                    setKeymap(km)
                    return def.name
                },
                null,
                'Failed to load layout',
            )
            if (name) toast.success(`Layout loaded: ${name}`)
        },
        [service, setKeymap],
    )

    if (!service) return null

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept=".json,.vil,application/json"
                hidden
                onChange={onPick}
            />
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(): void => inputRef.current?.click()}
                    >
                        <Upload aria-label="Load layout JSON" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Load layout JSON</p>
                </TooltipContent>
            </Tooltip>
        </>
    )
}
