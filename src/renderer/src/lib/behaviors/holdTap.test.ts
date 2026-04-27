import { describe, it, expect } from 'vitest'
import {
    HoldTapType,
    isHoldTapBinding,
    parseHoldTapBinding,
    getTapParam,
    getHoldParam,
    type BehaviorMapLike,
    type BehaviorDetailsLike,
    type BehaviorBindingLike,
    type BehaviorParameterValueDescriptionLike,
} from './holdTap'

// Mock behavior data for testing
const createMockBehavior = (
    id: number,
    displayName: string,
    hasLayerParam: boolean = false,
    hasTwoParams: boolean = true,
): BehaviorDetailsLike => {
    const param1: BehaviorParameterValueDescriptionLike[] =
        hasTwoParams || hasLayerParam
            ? [
                  hasLayerParam
                      ? { name: 'Layer', layerId: {} }
                      : {
                            name: 'Modifier',
                            hidUsage: { keyboardMax: 255, consumerMax: 0 },
                        },
              ]
            : []

    const param2: BehaviorParameterValueDescriptionLike[] = hasTwoParams
        ? [{ name: 'Key', hidUsage: { keyboardMax: 255, consumerMax: 0 } }]
        : []

    return {
        id,
        displayName,
        metadata: [{ param1, param2 }],
    }
}

const createMockBinding = (
    behaviorId: number,
    param1: number,
    param2: number,
): BehaviorBindingLike => ({
    behaviorId,
    param1,
    param2,
})

const createBehaviorMap = (
    map: Record<number, BehaviorDetailsLike>,
): BehaviorMapLike => map

describe('Hold-Tap Binding Detection and Parsing', () => {
    describe('isHoldTapBinding', () => {
        it('detects Layer-Tap from display name "Layer-Tap"', () => {
            const behaviors = createBehaviorMap({
                1: createMockBehavior(1, 'Layer-Tap', true, true),
            })
            const binding = createMockBinding(1, 2, 4) // layer 2, key A

            const result = isHoldTapBinding(binding, behaviors)

            expect(result.isHoldTap).toBe(true)
            expect(result.type).toBe(HoldTapType.LayerTap)
        })

        it('detects Layer-Tap from display name "lt"', () => {
            const behaviors = createBehaviorMap({
                1: createMockBehavior(1, 'lt', true, true),
            })
            const binding = createMockBinding(1, 1, 5)

            const result = isHoldTapBinding(binding, behaviors)

            expect(result.isHoldTap).toBe(true)
            expect(result.type).toBe(HoldTapType.LayerTap)
        })

        it('detects Mod-Tap from display name "Mod-Tap"', () => {
            const behaviors = createBehaviorMap({
                2: createMockBehavior(2, 'Mod-Tap', false, true),
            })
            const binding = createMockBinding(2, 224, 4) // LeftCtrl, key A

            const result = isHoldTapBinding(binding, behaviors)

            expect(result.isHoldTap).toBe(true)
            expect(result.type).toBe(HoldTapType.ModTap)
        })

        it('detects Mod-Tap from display name "mt"', () => {
            const behaviors = createBehaviorMap({
                2: createMockBehavior(2, 'mt', false, true),
            })
            const binding = createMockBinding(2, 225, 6)

            const result = isHoldTapBinding(binding, behaviors)

            expect(result.isHoldTap).toBe(true)
            expect(result.type).toBe(HoldTapType.ModTap)
        })

        it('detects Sticky Key from display name "Sticky Key"', () => {
            const behaviors = createBehaviorMap({
                3: createMockBehavior(3, 'Sticky Key', false, false),
            })
            const binding = createMockBinding(3, 225, 0) // LeftShift

            const result = isHoldTapBinding(binding, behaviors)

            expect(result.isHoldTap).toBe(true)
            expect(result.type).toBe(HoldTapType.StickyKey)
        })

        it('detects Sticky Key from display name "sk"', () => {
            const behaviors = createBehaviorMap({
                3: createMockBehavior(3, 'sk', false, false),
            })
            const binding = createMockBinding(3, 224, 0)

            const result = isHoldTapBinding(binding, behaviors)

            expect(result.isHoldTap).toBe(true)
            expect(result.type).toBe(HoldTapType.StickyKey)
        })

        it('returns not hold-tap for unknown behavior', () => {
            const behaviors = createBehaviorMap({})
            const binding = createMockBinding(999, 0, 0)

            const result = isHoldTapBinding(binding, behaviors)

            expect(result.isHoldTap).toBe(false)
            expect(result.type).toBeNull()
        })

        it('returns not hold-tap for regular key press behavior', () => {
            const behaviors = createBehaviorMap({
                4: {
                    id: 4,
                    displayName: 'Key Press',
                    metadata: [{ param1: [], param2: [] }],
                },
            })
            const binding = createMockBinding(4, 0, 0)

            const result = isHoldTapBinding(binding, behaviors)

            expect(result.isHoldTap).toBe(false)
            expect(result.type).toBeNull()
        })

        it('detects custom hold-tap from metadata structure', () => {
            const behaviors = createBehaviorMap({
                5: createMockBehavior(5, 'my_custom_behavior', false, true),
            })
            const binding = createMockBinding(5, 1, 4)

            const result = isHoldTapBinding(binding, behaviors)

            expect(result.isHoldTap).toBe(true)
            expect(result.type).toBe(HoldTapType.Custom)
        })

        it('detects layer-tap from metadata with layerId param', () => {
            const behaviors = createBehaviorMap({
                6: createMockBehavior(6, 'custom_layer_behavior', true, true),
            })
            const binding = createMockBinding(6, 3, 10)

            const result = isHoldTapBinding(binding, behaviors)

            expect(result.isHoldTap).toBe(true)
            expect(result.type).toBe(HoldTapType.LayerTap)
        })
    })

    describe('parseHoldTapBinding', () => {
        it('parses Layer-Tap binding correctly', () => {
            const behaviors = createBehaviorMap({
                1: createMockBehavior(1, 'Layer-Tap', true, true),
            })
            const binding = createMockBinding(1, 2, 4) // layer 2, key A

            const parsed = parseHoldTapBinding(binding, behaviors)

            expect(parsed).not.toBeNull()
            expect(parsed?.type).toBe(HoldTapType.LayerTap)
            expect(parsed?.behaviorId).toBe(1)
            expect(parsed?.holdParam).toBe(2)
            expect(parsed?.tapParam).toBe(4)
            expect(parsed?.hasTapAndHold).toBe(true)
        })

        it('parses Mod-Tap binding correctly', () => {
            const behaviors = createBehaviorMap({
                2: createMockBehavior(2, 'Mod-Tap', false, true),
            })
            const binding = createMockBinding(2, 224, 5) // LeftCtrl, key B

            const parsed = parseHoldTapBinding(binding, behaviors)

            expect(parsed).not.toBeNull()
            expect(parsed?.type).toBe(HoldTapType.ModTap)
            expect(parsed?.behaviorId).toBe(2)
            expect(parsed?.holdParam).toBe(224)
            expect(parsed?.tapParam).toBe(5)
            expect(parsed?.hasTapAndHold).toBe(true)
        })

        it('parses Sticky Key binding correctly (single param)', () => {
            const behaviors = createBehaviorMap({
                3: createMockBehavior(3, 'Sticky Key', false, false),
            })
            const binding = createMockBinding(3, 225, 0) // LeftShift

            const parsed = parseHoldTapBinding(binding, behaviors)

            expect(parsed).not.toBeNull()
            expect(parsed?.type).toBe(HoldTapType.StickyKey)
            expect(parsed?.behaviorId).toBe(3)
            expect(parsed?.holdParam).toBe(225)
            expect(parsed?.tapParam).toBeUndefined()
            expect(parsed?.hasTapAndHold).toBe(false)
        })

        it('returns null for non-hold-tap binding', () => {
            const behaviors = createBehaviorMap({
                4: {
                    id: 4,
                    displayName: 'Key Press',
                    metadata: [{ param1: [], param2: [] }],
                },
            })
            const binding = createMockBinding(4, 4, 0)

            const parsed = parseHoldTapBinding(binding, behaviors)

            expect(parsed).toBeNull()
        })

        it('returns null for unknown behavior', () => {
            const behaviors = createBehaviorMap({})
            const binding = createMockBinding(999, 1, 2)

            const parsed = parseHoldTapBinding(binding, behaviors)

            expect(parsed).toBeNull()
        })
    })

    describe('getTapParam', () => {
        it('returns tap param for Layer-Tap', () => {
            const behaviors = createBehaviorMap({
                1: createMockBehavior(1, 'Layer-Tap', true, true),
            })
            const binding = createMockBinding(1, 2, 4)

            const tapParam = getTapParam(binding, behaviors)

            expect(tapParam).toBe(4)
        })

        it('returns tap param for Mod-Tap', () => {
            const behaviors = createBehaviorMap({
                2: createMockBehavior(2, 'Mod-Tap', false, true),
            })
            const binding = createMockBinding(2, 224, 10)

            const tapParam = getTapParam(binding, behaviors)

            expect(tapParam).toBe(10)
        })

        it('returns undefined for Sticky Key (no tap param)', () => {
            const behaviors = createBehaviorMap({
                3: createMockBehavior(3, 'Sticky Key', false, false),
            })
            const binding = createMockBinding(3, 225, 0)

            const tapParam = getTapParam(binding, behaviors)

            expect(tapParam).toBeUndefined()
        })

        it('returns undefined for non-hold-tap', () => {
            const behaviors = createBehaviorMap({
                4: {
                    id: 4,
                    displayName: 'Key Press',
                    metadata: [{ param1: [], param2: [] }],
                },
            })
            const binding = createMockBinding(4, 4, 0)

            const tapParam = getTapParam(binding, behaviors)

            expect(tapParam).toBeUndefined()
        })
    })

    describe('getHoldParam', () => {
        it('returns hold param (layer) for Layer-Tap', () => {
            const behaviors = createBehaviorMap({
                1: createMockBehavior(1, 'Layer-Tap', true, true),
            })
            const binding = createMockBinding(1, 3, 4)

            const holdParam = getHoldParam(binding, behaviors)

            expect(holdParam).toBe(3)
        })

        it('returns hold param (modifier) for Mod-Tap', () => {
            const behaviors = createBehaviorMap({
                2: createMockBehavior(2, 'Mod-Tap', false, true),
            })
            const binding = createMockBinding(2, 226, 10) // LeftAlt

            const holdParam = getHoldParam(binding, behaviors)

            expect(holdParam).toBe(226)
        })

        it('returns hold param for Sticky Key', () => {
            const behaviors = createBehaviorMap({
                3: createMockBehavior(3, 'Sticky Key', false, false),
            })
            const binding = createMockBinding(3, 225, 0)

            const holdParam = getHoldParam(binding, behaviors)

            expect(holdParam).toBe(225)
        })

        it('returns undefined for non-hold-tap', () => {
            const behaviors = createBehaviorMap({
                4: {
                    id: 4,
                    displayName: 'Key Press',
                    metadata: [{ param1: [], param2: [] }],
                },
            })
            const binding = createMockBinding(4, 4, 0)

            const holdParam = getHoldParam(binding, behaviors)

            expect(holdParam).toBeUndefined()
        })
    })

    describe('edge cases', () => {
        it('handles behavior with empty metadata array', () => {
            const behaviors = createBehaviorMap({
                5: {
                    id: 5,
                    displayName: 'Empty Behavior',
                    metadata: [],
                },
            })
            const binding = createMockBinding(5, 1, 2)

            const result = isHoldTapBinding(binding, behaviors)

            expect(result.isHoldTap).toBe(false)
            expect(result.type).toBeNull()
        })

        it('handles case-insensitive behavior name matching', () => {
            const behaviors = createBehaviorMap({
                6: createMockBehavior(6, 'LAYER-TAP', true, true),
            })
            const binding = createMockBinding(6, 1, 4)

            const result = isHoldTapBinding(binding, behaviors)

            expect(result.isHoldTap).toBe(true)
            expect(result.type).toBe(HoldTapType.LayerTap)
        })

        it('handles display name with "Layer Tap" (space instead of hyphen)', () => {
            const behaviors = createBehaviorMap({
                7: createMockBehavior(7, 'Layer Tap', true, true),
            })
            const binding = createMockBinding(7, 1, 4)

            const result = isHoldTapBinding(binding, behaviors)

            expect(result.isHoldTap).toBe(true)
            expect(result.type).toBe(HoldTapType.LayerTap)
        })

        it('handles binding with zero parameters', () => {
            const behaviors = createBehaviorMap({
                1: createMockBehavior(1, 'Layer-Tap', true, true),
            })
            const binding = createMockBinding(1, 0, 0)

            const parsed = parseHoldTapBinding(binding, behaviors)

            expect(parsed).not.toBeNull()
            expect(parsed?.holdParam).toBe(0)
            expect(parsed?.tapParam).toBe(0)
        })
    })
})
