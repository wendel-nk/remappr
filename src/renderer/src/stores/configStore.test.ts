// pattern-check: skip — store unit test, no production logic
import { describe, it, expect, beforeEach } from 'vitest'
import useConfigStore from './configStore'

const VALID = `{
    "schemaVersion": 1,
    "kind": "remappr.keymap",
    "meta": { "name": "T", "target": null },
    "keyboard": { "id": "k", "name": "K", "keys": [{ "x": 0, "y": 0 }] },
    "layers": [{ "name": "base", "bindings": ["A"] }]
}`

describe('configStore', () => {
    beforeEach(() => {
        useConfigStore.getState().reset()
    })

    it('starts empty', () => {
        const s = useConfigStore.getState()
        expect(s.config).toBeNull()
        expect(s.source).toBeNull()
        expect(s.error).toBeNull()
    })

    it('loadFromSource parses + stores valid JSON', () => {
        const ok = useConfigStore.getState().loadFromSource(VALID)
        const s = useConfigStore.getState()
        expect(ok).toBe(true)
        expect(s.config?.meta.name).toBe('T')
        expect(s.config?.layers[0].bindings[0]).toMatchObject({
            type: 'key_press',
        })
        expect(s.source).toBe(VALID)
        expect(s.error).toBeNull()
    })

    it('loadFromSource surfaces parse errors without throwing', () => {
        const ok = useConfigStore.getState().loadFromSource('{ not valid')
        const s = useConfigStore.getState()
        expect(ok).toBe(false)
        expect(s.config).toBeNull()
        expect(s.error).toBeTruthy()
    })

    it('reset clears state', () => {
        useConfigStore.getState().loadFromSource(VALID)
        useConfigStore.getState().reset()
        const s = useConfigStore.getState()
        expect(s.config).toBeNull()
        expect(s.source).toBeNull()
        expect(s.error).toBeNull()
    })
})
