import { EllipsisVertical, Trash } from 'lucide-react'
import LayerNameDialog from '../editor/LayerNameDialog'
import {
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/ui/sidebar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/ui/dropdown-menu'

interface LayerItem {
    id: number
    name: string
    index: number
    selected: boolean
}

interface LayerListItemProps {
    item: LayerItem
    selectedLayerIndex: number
    canRemove?: boolean
    onSelect: (index: number) => void
    onRemove: (index: number) => void
    onSaveNewLabel: (
        id: number,
        oldName: string,
        newName: string | null,
    ) => void
}

export function LayerListItem({
    item,
    selectedLayerIndex,
    canRemove,
    onSelect,
    onRemove,
    onSaveNewLabel,
}: LayerListItemProps): JSX.Element {
    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                isActive={item.index === selectedLayerIndex}
                onClick={() => onSelect(item.index)}
            >
                <span>{item.name}</span>
            </SidebarMenuButton>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <SidebarMenuAction
                        showOnHover
                        className="data-[state=open]:bg-accent rounded-sm"
                    >
                        <EllipsisVertical />{' '}
                        <span className="sr-only">More</span>
                    </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start">
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <LayerNameDialog
                            onClose={() => {}}
                            editLabelData={item}
                            handleSaveNewLabel={onSaveNewLabel}
                        />
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        variant="destructive"
                        disabled={!canRemove}
                        onClick={(e) => {
                            e.stopPropagation()
                            onRemove(item.index)
                        }}
                    >
                        <Trash />
                        <span>Delete</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </SidebarMenuItem>
    )
}
