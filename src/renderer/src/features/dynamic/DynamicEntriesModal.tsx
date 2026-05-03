// pattern-check: skip — thin Modal+Tabs shell, per-tab content delegated
import type { KeyboardService } from '@firmware'
import { Modal } from '@/ui/modal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'

import { AltRepeatKeyTab } from './tabs/AltRepeatKeyTab'
import { ComboTab } from './tabs/ComboTab'
import { KeyOverrideTab } from './tabs/KeyOverrideTab'
import { TapDanceTab } from './tabs/TapDanceTab'

interface Props {
    service: KeyboardService | null
    opened: boolean
    onClose: () => void
}

export function DynamicEntriesModal({
    service,
    opened,
    onClose,
}: Props): JSX.Element | null {
    if (!service) return null
    const counts = service.dynamic?.getCounts()
    const hasARK = !!service.dynamic?.getAltRepeatKey
    if (!counts) return null

    const hasAny =
        counts.tapDance > 0 ||
        counts.combo > 0 ||
        counts.keyOverride > 0 ||
        hasARK
    if (!hasAny) return null

    const defaultTab =
        counts.tapDance > 0
            ? 'td'
            : counts.combo > 0
              ? 'combo'
              : counts.keyOverride > 0
                ? 'ko'
                : 'ark'

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title="Dynamic Entries"
            xButton={true}
            isDismissable={true}
            showFooter={false}
        >
            <Tabs defaultValue={defaultTab}>
                <TabsList>
                    {counts.tapDance > 0 && (
                        <TabsTrigger value="td">Tap Dance</TabsTrigger>
                    )}
                    {counts.combo > 0 && (
                        <TabsTrigger value="combo">Combo</TabsTrigger>
                    )}
                    {counts.keyOverride > 0 && (
                        <TabsTrigger value="ko">Key Override</TabsTrigger>
                    )}
                    {hasARK && (
                        <TabsTrigger value="ark">Alt Repeat Key</TabsTrigger>
                    )}
                </TabsList>
                {counts.tapDance > 0 && (
                    <TabsContent value="td">
                        <TapDanceTab
                            service={service}
                            count={counts.tapDance}
                            opened={opened}
                        />
                    </TabsContent>
                )}
                {counts.combo > 0 && (
                    <TabsContent value="combo">
                        <ComboTab
                            service={service}
                            count={counts.combo}
                            opened={opened}
                        />
                    </TabsContent>
                )}
                {counts.keyOverride > 0 && (
                    <TabsContent value="ko">
                        <KeyOverrideTab
                            service={service}
                            count={counts.keyOverride}
                            opened={opened}
                        />
                    </TabsContent>
                )}
                {hasARK && (
                    <TabsContent value="ark">
                        <AltRepeatKeyTab service={service} opened={opened} />
                    </TabsContent>
                )}
            </Tabs>
        </Modal>
    )
}
