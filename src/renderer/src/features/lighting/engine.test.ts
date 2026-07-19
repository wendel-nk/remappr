import { describe, expect, it } from 'vitest'

import { lightingFromDevice } from './engine'

describe('lightingFromDevice', () => {
    it('honors a firmware-provided master off state', () => {
        const lighting = lightingFromDevice(
            {
                enabled: false,
                mode: 0,
                brightness: 255,
                speed: 128,
                color: { h: 128, s: 255, v: 255 },
            },
            'Solid',
            {
                kind: 'zmk_underglow',
                effects: ['Solid'],
                hasColor: true,
                hasSpeed: true,
            },
        )

        expect(lighting.enabled).toBe(false)
    })
})
