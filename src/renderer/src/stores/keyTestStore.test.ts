// pattern-check: skip — unit tests for the Key Test zustand slice
import { beforeEach, describe, expect, it } from 'vitest'
import useKeyTestStore from './keyTestStore'

function reset(): void {
    useKeyTestStore.setState({ active: false, seen: new Set<number>() })
}

describe('keyTestStore', () => {
    beforeEach(reset)

    it('markSeen accumulates distinct positions', () => {
        const { markSeen } = useKeyTestStore.getState()
        markSeen(4)
        markSeen(4)
        markSeen(9)
        expect([...useKeyTestStore.getState().seen].sort()).toEqual([4, 9])
    })

    it('toggling the mode clears the seen sweep', () => {
        useKeyTestStore.getState().markSeen(1)
        useKeyTestStore.getState().toggle()
        expect(useKeyTestStore.getState().active).toBe(true)
        expect(useKeyTestStore.getState().seen.size).toBe(0)
    })

    it('setActive to the same value is a no-op (keeps the sweep)', () => {
        useKeyTestStore.setState({ active: true, seen: new Set([2, 3]) })
        useKeyTestStore.getState().setActive(true)
        expect(useKeyTestStore.getState().seen.size).toBe(2)
    })

    it('setActive to a new value starts a fresh sweep', () => {
        useKeyTestStore.setState({ active: false, seen: new Set([7]) })
        useKeyTestStore.getState().setActive(true)
        expect(useKeyTestStore.getState().seen.size).toBe(0)
    })

    it('reset clears seen without changing active', () => {
        useKeyTestStore.setState({ active: true, seen: new Set([1, 2]) })
        useKeyTestStore.getState().reset()
        expect(useKeyTestStore.getState().active).toBe(true)
        expect(useKeyTestStore.getState().seen.size).toBe(0)
    })
})
