// pattern-check: skip — global keydown shortcut effect extracted from KeyboardView
import { useEffect } from 'react'
import type { WorkspaceMode } from '@/stores/userSettingsStore'
import type { KeyPosition } from '../PhysicalLayoutCanvas'
import { neighborInDirection } from './helpers'

interface Inputs {
    assignOpen: boolean
    paletteOpen: boolean
    workspace: WorkspaceMode
    targetPositions: number[]
    selectedKeyPosition: number | undefined
    multiSelection: Set<number>
    positions: KeyPosition[]
    handleClearBindings: () => void
    clearSelection: () => void
    setSelectedKeyPosition: (position: number | undefined) => void
    setAssignOpen: (open: boolean) => void
    setPaletteOpen: (open: boolean) => void
    anchorRef: React.MutableRefObject<number | null>
}

/** Stage keyboard shortcuts: arrows move the single selection, ⌘K opens assign,
 *  Backspace/Delete clears the binding(s), Escape clears the selection. */
export function useStageShortcuts({
    assignOpen,
    paletteOpen,
    workspace,
    targetPositions,
    selectedKeyPosition,
    multiSelection,
    positions,
    handleClearBindings,
    clearSelection,
    setSelectedKeyPosition,
    setAssignOpen,
    setPaletteOpen,
    anchorRef,
}: Inputs): void {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent): void => {
            const t = e.target as HTMLElement | null
            const typing =
                !!t &&
                (t.tagName === 'INPUT' ||
                    t.tagName === 'TEXTAREA' ||
                    t.isContentEditable)
            if (e.key === 'Escape') {
                clearSelection()
                return
            }
            if (typing) return
            const meta = e.metaKey || e.ctrlKey
            if (meta && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault()
                if (targetPositions.length === 0) return
                if (workspace === 'command') setPaletteOpen(true)
                else setAssignOpen(true)
                return
            }
            if (assignOpen || paletteOpen) return
            if (e.key === 'Backspace' || e.key === 'Delete') {
                if (targetPositions.length > 0) {
                    e.preventDefault()
                    handleClearBindings()
                }
                return
            }
            const dirMap = {
                ArrowLeft: 'left',
                ArrowRight: 'right',
                ArrowUp: 'up',
                ArrowDown: 'down',
            } as const
            const dir = dirMap[e.key as keyof typeof dirMap]
            if (
                dir &&
                !meta &&
                selectedKeyPosition != null &&
                multiSelection.size === 0
            ) {
                const n = neighborInDirection(
                    positions,
                    selectedKeyPosition,
                    dir,
                )
                if (n != null) {
                    e.preventDefault()
                    anchorRef.current = n
                    setSelectedKeyPosition(n)
                }
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return (): void => window.removeEventListener('keydown', onKeyDown)
    }, [
        assignOpen,
        paletteOpen,
        workspace,
        targetPositions,
        selectedKeyPosition,
        multiSelection,
        positions,
        handleClearBindings,
        clearSelection,
        setSelectedKeyPosition,
        setAssignOpen,
        setPaletteOpen,
        anchorRef,
    ])
}
