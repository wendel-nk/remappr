// Pattern check: no GoF pattern (-) — rejected — file-picker UI glue around service.applyLayout; small single-purpose component.
import { useCallback, useRef } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'
import useConnectionStore from '@/stores/connectionStore'
import useKeymapStore from '@/stores/keymapStore'
import {
    cacheKey,
    parseSideloadJson,
    saveCached,
} from '@firmware/qmk/layoutSideload'

export function LayoutSideloadAction(): JSX.Element | null {
    const { service } = useConnectionStore()
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
            try {
                const text = await file.text()
                const def = parseSideloadJson(text)
                await service.applyLayout(def)
                const key = cacheKey(service.deviceInfo)
                if (key) saveCached(key, def)
                const km = await service.getKeymap()
                setKeymap(km)
                toast.success(`Layout loaded: ${def.name}`)
            } catch (err) {
                console.error('Layout sideload failed', err)
                toast.error(
                    `Failed to load layout: ${(err as Error).message ?? 'unknown error'}`,
                )
            }
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
