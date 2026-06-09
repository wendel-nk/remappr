// pattern-check: skip — extract self-contained keydown useEffect verbatim into a hook, no abstraction
// Builder keyboard shortcuts, extracted verbatim from Builder.tsx. Reads the
// builder/config stores via getState(), so it needs no arguments. Mounts a single
// window 'keydown' listener for: undo/redo, select-all, duplicate, delete,
// arrow-nudge, escape — skipped while typing in a field.
import { useEffect } from 'react'
import useBuilderStore from '@/stores/builderStore'
import useConfigStore from '@/stores/configStore'
import {
    duplicateKeys,
    removeKeys,
    snap as snapStep,
    updateKeys,
} from './geometryEditor'

export function useBuilderKeyboard(): void {
    // Keyboard shortcuts (ported from the prototype): undo/redo, select-all,
    // duplicate, delete, arrow-nudge, escape. Skipped while typing in a field.
    useEffect(() => {
        const onKey = (e: KeyboardEvent): void => {
            const t = e.target as HTMLElement
            if (
                t.tagName === 'INPUT' ||
                t.tagName === 'TEXTAREA' ||
                t.isContentEditable
            )
                return
            const store = useBuilderStore.getState()
            const cfg = useConfigStore.getState().config
            const mod = e.metaKey || e.ctrlKey
            if (mod && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault()
                e.shiftKey ? store.redo() : store.undo()
                return
            }
            if (mod && e.key === 'y') {
                e.preventDefault()
                store.redo()
                return
            }
            if (e.key === 'Escape') {
                store.clearSelection()
                return
            }
            if (!cfg) return
            if (mod && (e.key === 'a' || e.key === 'A')) {
                e.preventDefault()
                store.setSelection(new Set(cfg.keyboard.keys.map((_, i) => i)))
                return
            }
            const sel = store.selection
            if (mod && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault()
                if (!sel.size) return
                const { config: next, newIndices } = duplicateKeys(cfg, sel)
                store.commit(next)
                store.setSelection(new Set(newIndices))
                return
            }
            if (!sel.size) return
            if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault()
                store.commit(removeKeys(cfg, sel))
                store.clearSelection()
                return
            }
            if (e.key.startsWith('Arrow')) {
                e.preventDefault()
                const step = e.shiftKey ? 1 : 0.25
                const d: Record<string, [number, number]> = {
                    ArrowLeft: [-step, 0],
                    ArrowRight: [step, 0],
                    ArrowUp: [0, -step],
                    ArrowDown: [0, step],
                }
                const delta = d[e.key]
                if (!delta) return
                store.commit(
                    updateKeys(cfg, (k, i) =>
                        sel.has(i)
                            ? {
                                  ...k,
                                  x: snapStep(k.x + delta[0], 0.001),
                                  y: snapStep(k.y + delta[1], 0.001),
                                  ...(k.rx !== undefined
                                      ? { rx: k.rx + delta[0] }
                                      : {}),
                                  ...(k.ry !== undefined
                                      ? { ry: k.ry + delta[1] }
                                      : {}),
                              }
                            : k,
                    ),
                )
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])
}
