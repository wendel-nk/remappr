import { describe, it, expect, beforeEach } from 'vitest'
import useUndoRedoStore from './undoRedoStore'

describe('undoRedoStore', () => {
    beforeEach(() => {
        useUndoRedoStore.getState().reset()
    })

    it('canUndo / canRedo are false on empty stacks', () => {
        const s = useUndoRedoStore.getState()
        expect(s.canUndo()).toBe(false)
        expect(s.canRedo()).toBe(false)
    })

    it('doIt pushes onto undoStack and clears redoStack', async () => {
        let value = 0
        await useUndoRedoStore.getState().doIt(async () => {
            value = 1
            return async () => {
                value = 0
            }
        })

        expect(value).toBe(1)
        const s = useUndoRedoStore.getState()
        expect(s.undoStack.length).toBe(1)
        expect(s.redoStack.length).toBe(0)
        expect(s.canUndo()).toBe(true)
    })

    it('undo invokes undo callback and moves entry to redoStack', async () => {
        let value = 0
        await useUndoRedoStore.getState().doIt(async () => {
            value = 1
            return async () => {
                value = 0
            }
        })

        await useUndoRedoStore.getState().undo()

        expect(value).toBe(0)
        const s = useUndoRedoStore.getState()
        expect(s.undoStack.length).toBe(0)
        expect(s.redoStack.length).toBe(1)
        expect(s.canRedo()).toBe(true)
    })

    it('redo replays do callback and pushes back onto undoStack', async () => {
        let value = 0
        const doCb = async (): Promise<() => Promise<void>> => {
            value = 1
            return async () => {
                value = 0
            }
        }
        await useUndoRedoStore.getState().doIt(doCb)
        await useUndoRedoStore.getState().undo()
        await useUndoRedoStore.getState().redo()

        expect(value).toBe(1)
        const s = useUndoRedoStore.getState()
        expect(s.undoStack.length).toBe(1)
        expect(s.redoStack.length).toBe(0)
    })

    it('undo on empty stack throws', async () => {
        await expect(useUndoRedoStore.getState().undo()).rejects.toThrow(
            /empty stack/,
        )
    })

    it('redo on empty stack throws', async () => {
        await expect(useUndoRedoStore.getState().redo()).rejects.toThrow(
            /empty stack/,
        )
    })

    it('new doIt clears redoStack (preserveRedo=false)', async () => {
        const cb =
            async (): Promise<() => Promise<void>> =>
            async (): Promise<void> => {}
        await useUndoRedoStore.getState().doIt(cb)
        await useUndoRedoStore.getState().undo()
        expect(useUndoRedoStore.getState().redoStack.length).toBe(1)

        await useUndoRedoStore.getState().doIt(cb)

        expect(useUndoRedoStore.getState().redoStack.length).toBe(0)
    })

    it('reset clears both stacks', async () => {
        await useUndoRedoStore.getState().doIt(async () => async () => {})
        useUndoRedoStore.getState().reset()

        const s = useUndoRedoStore.getState()
        expect(s.undoStack.length).toBe(0)
        expect(s.redoStack.length).toBe(0)
    })
})
