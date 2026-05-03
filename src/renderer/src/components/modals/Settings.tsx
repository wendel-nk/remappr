// Pattern check: no GoF pattern (-) — rejected — UI restructure into sidemenu nav with sectioned panels; no class hierarchy or polymorphism warranted.
import { useState } from 'react'
import { Settings as SettingsIcon, Palette, Radio, Info } from 'lucide-react'
import { Modal } from '@/ui/modal'
import { ScrollArea } from '@/ui/scroll-area'
import { cn } from '@/lib/cn'
import { GeneralSection } from './settings/GeneralSection'
import { CommunicationSection } from './settings/CommunicationSection'
import { AboutSection } from './settings/AboutSection'

interface SettingsProps {
    opened?: boolean
    onClose?: () => void
}

type SettingsSection = 'general' | 'communication' | 'about'

const SECTIONS: {
    id: SettingsSection
    label: string
    icon: typeof Palette
}[] = [
    { id: 'general', label: 'General', icon: Palette },
    { id: 'communication', label: 'Communication', icon: Radio },
    { id: 'about', label: 'About', icon: Info },
]

export function Settings({ opened, onClose }: SettingsProps): JSX.Element {
    const [section, setSection] = useState<SettingsSection>('general')
    return (
        <Modal
            opened={opened}
            onClose={onClose}
            customModalBoxClass="w-11/14 max-w-4xl"
            type="icon"
            icon={<SettingsIcon />}
            variant="ghost"
        >
            <div className="flex min-h-[28rem] gap-4">
                <aside className="w-48 shrink-0 border-r pr-2">
                    <nav className="flex flex-col gap-0.5">
                        {SECTIONS.map(({ id, label, icon: Icon }) => {
                            const active = section === id
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setSection(id)}
                                    aria-current={active ? 'page' : undefined}
                                    className={cn(
                                        'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                        active
                                            ? 'bg-accent text-accent-foreground'
                                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </button>
                            )
                        })}
                    </nav>
                </aside>
                <ScrollArea className="max-h-[60vh] flex-1 pr-2">
                    {section === 'general' && <GeneralSection />}
                    {section === 'communication' && <CommunicationSection />}
                    {section === 'about' && <AboutSection />}
                </ScrollArea>
            </div>
        </Modal>
    )
}
