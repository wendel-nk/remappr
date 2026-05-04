import {useState} from 'react'
import {Check, ChevronsUpDown} from 'lucide-react'
import {Button} from '@/ui/button'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/ui/command'
import {Popover, PopoverContent, PopoverTrigger} from '@/ui/popover'
import {cn} from '@/lib/cn'
import {
    THEME_NAMES,
    type ThemeName,
    useTheme,
} from '@/providers/ThemeProvider'

const THEME_LABELS: Record<ThemeName, string> = {
    default: 'Default',
    claude: 'Claude',
    supabase: 'Supabase',
    't3-chat': 'T3 Chat',
    vercel: 'Vercel',
    twitter: 'Twitter',
    bubblegum: 'Bubblegum',
    catppuccin: 'Catppuccin',
}

export function ThemePicker (): JSX.Element {
    const {themeName, setThemeName} = useTheme()
    const [open, setOpen] = useState( false )

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-48 justify-between"
                >
                    {THEME_LABELS[themeName]}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-0">
                <Command>
                    <CommandInput placeholder="Search themes..." />
                    <CommandList>
                        <CommandEmpty>No theme found.</CommandEmpty>
                        <CommandGroup>
                            {THEME_NAMES.map( ( name ) => (
                                <CommandItem
                                    key={name}
                                    value={name}
                                    onSelect={(): void => {
                                        setThemeName( name )
                                        setOpen( false )
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            'mr-2 h-4 w-4',
                                            themeName === name
                                                ? 'opacity-100'
                                                : 'opacity-0',
                                        )}
                                    />
                                    {THEME_LABELS[name]}
                                </CommandItem>
                            ) )}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
