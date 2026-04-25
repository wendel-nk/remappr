/**
 * Hold-Tap Binding Detection and Parsing Utilities
 *
 * This module provides utilities for detecting and parsing hold-tap behavior bindings
 * (Layer-Tap, Mod-Tap, Sticky Key) used in ZMK keyboards.
 */

/**
 * Enum representing the types of hold-tap behaviors supported
 */
export enum HoldTapType {
    /** Layer-Tap: Hold activates a layer, tap sends a keycode */
    LayerTap = 'layer-tap',
    /** Mod-Tap: Hold activates a modifier, tap sends a keycode */
    ModTap = 'mod-tap',
    /** Sticky Key: Single-press activates a key/modifier that stays active for the next key */
    StickyKey = 'sticky-key',
    /** Custom Hold-Tap: A user-defined hold-tap behavior */
    Custom = 'custom',
}

/**
 * Represents a parsed hold-tap binding with extracted tap and hold actions
 */
export interface HoldTapBinding {
    /** The type of hold-tap behavior */
    type: HoldTapType
    /** The behavior ID from the original binding */
    behaviorId: number
    /** The hold action parameter (layer ID or modifier) */
    holdParam: number
    /** The tap action parameter (keycode), undefined for single-param behaviors like sticky key */
    tapParam: number | undefined
    /** Whether this binding has both hold and tap parameters */
    hasTapAndHold: boolean
}

/**
 * Result of checking if a behavior is a hold-tap type
 */
export interface HoldTapDetectionResult {
    /** Whether the binding is a hold-tap type */
    isHoldTap: boolean
    /** The detected hold-tap type, if applicable */
    type: HoldTapType | null
}

/**
 * Minimal interface for BehaviorBinding (matches ZMK library structure)
 */
export interface BehaviorBindingLike {
    behaviorId: number
    param1: number
    param2: number
}

/**
 * Minimal interface for behavior parameter value description
 */
export interface BehaviorParameterValueDescriptionLike {
    name?: string
    nil?: object
    constant?: number
    range?: { min: number; max: number }
    hidUsage?: { keyboardMax: number; consumerMax: number }
    layerId?: object
}

/**
 * Minimal interface for behavior binding parameter set
 */
export interface BehaviorBindingParametersSetLike {
    param1: BehaviorParameterValueDescriptionLike[]
    param2: BehaviorParameterValueDescriptionLike[]
}

/**
 * Minimal interface for behavior details response
 */
export interface BehaviorDetailsLike {
    id: number
    displayName: string
    metadata: BehaviorBindingParametersSetLike[]
}

/**
 * Map of behavior IDs to behavior details
 */
export type BehaviorMapLike = Record<number, BehaviorDetailsLike>

/**
 * Determines the hold-tap type based on behavior display name
 */
function getHoldTapTypeFromName(displayName: string): HoldTapType | null {
    const lowerName = displayName.toLowerCase()

    if (
        lowerName.includes('layer-tap') ||
        lowerName.includes('layer tap') ||
        lowerName === 'lt'
    ) {
        return HoldTapType.LayerTap
    }

    if (
        lowerName.includes('mod-tap') ||
        lowerName.includes('mod tap') ||
        lowerName === 'mt'
    ) {
        return HoldTapType.ModTap
    }

    if (
        lowerName.includes('sticky') ||
        lowerName.includes('sticky-key') ||
        lowerName === 'sk'
    ) {
        return HoldTapType.StickyKey
    }

    return null
}

/**
 * Analyzes behavior metadata to determine if it's a hold-tap type based on parameter structure
 */
function analyzeMetadataForHoldTap(
    metadata: BehaviorBindingParametersSetLike[],
): { isHoldTap: boolean; hasLayerParam: boolean; hasTwoParams: boolean } {
    if (!metadata || metadata.length === 0) {
        return { isHoldTap: false, hasLayerParam: false, hasTwoParams: false }
    }

    // Check the first parameter set (most common case)
    const firstSet = metadata[0]
    const hasParam1 = firstSet.param1 && firstSet.param1.length > 0
    const hasParam2 = firstSet.param2 && firstSet.param2.length > 0

    // Check if param1 contains a layer ID parameter
    const hasLayerParam =
        hasParam1 &&
        firstSet.param1.some(
            (p) => p.layerId !== undefined && p.layerId !== null,
        )

    // A hold-tap typically has at least one parameter
    // Two-param behaviors (layer-tap, mod-tap) have both param1 and param2
    // Single-param behaviors (sticky-key) have only param1
    const isHoldTap = hasParam1
    const hasTwoParams = hasParam1 && hasParam2

    return { isHoldTap, hasLayerParam, hasTwoParams }
}

/**
 * Detects if a binding represents a hold-tap behavior
 *
 * @param binding - The behavior binding to check
 * @param behaviors - Map of all available behaviors
 * @returns Detection result indicating if binding is hold-tap and its type
 *
 * @example
 * ```typescript
 * const result = isHoldTapBinding(binding, behaviorMap);
 * if (result.isHoldTap) {
 *   console.log(`This is a ${result.type} binding`);
 * }
 * ```
 */
export function isHoldTapBinding(
    binding: BehaviorBindingLike,
    behaviors: BehaviorMapLike,
): HoldTapDetectionResult {
    const behavior = behaviors[binding.behaviorId]

    if (!behavior) {
        return { isHoldTap: false, type: null }
    }

    // First, try to detect from behavior name
    const typeFromName = getHoldTapTypeFromName(behavior.displayName)
    if (typeFromName !== null) {
        return { isHoldTap: true, type: typeFromName }
    }

    // Fallback: Analyze metadata structure
    const { isHoldTap, hasLayerParam, hasTwoParams } =
        analyzeMetadataForHoldTap(behavior.metadata)

    if (!isHoldTap) {
        return { isHoldTap: false, type: null }
    }

    // Infer type from parameter structure
    if (hasLayerParam) {
        return { isHoldTap: true, type: HoldTapType.LayerTap }
    }

    if (hasTwoParams) {
        // Has two params but not a layer - likely mod-tap or custom
        return { isHoldTap: true, type: HoldTapType.Custom }
    }

    // Single param behavior - could be sticky key
    return { isHoldTap: true, type: HoldTapType.StickyKey }
}

/**
 * Parses a hold-tap binding to extract tap and hold action parameters
 *
 * @param binding - The behavior binding to parse
 * @param behaviors - Map of all available behaviors
 * @returns Parsed hold-tap binding with extracted parameters, or null if not a hold-tap
 *
 * @example
 * ```typescript
 * const parsed = parseHoldTapBinding(binding, behaviorMap);
 * if (parsed) {
 *   console.log(`Hold: ${parsed.holdParam}, Tap: ${parsed.tapParam}`);
 * }
 * ```
 */
export function parseHoldTapBinding(
    binding: BehaviorBindingLike,
    behaviors: BehaviorMapLike,
): HoldTapBinding | null {
    const detection = isHoldTapBinding(binding, behaviors)

    if (!detection.isHoldTap || detection.type === null) {
        return null
    }

    const behavior = behaviors[binding.behaviorId]
    const { hasTwoParams } = analyzeMetadataForHoldTap(behavior.metadata)

    return {
        type: detection.type,
        behaviorId: binding.behaviorId,
        holdParam: binding.param1,
        tapParam: hasTwoParams ? binding.param2 : undefined,
        hasTapAndHold: hasTwoParams,
    }
}

/**
 * Extracts the tap action parameter from a hold-tap binding
 *
 * @param binding - The behavior binding to extract from
 * @param behaviors - Map of all available behaviors
 * @returns The tap parameter value, or undefined if not a hold-tap or no tap parameter
 *
 * @example
 * ```typescript
 * const tapKey = getTapParam(binding, behaviorMap);
 * if (tapKey !== undefined) {
 *   console.log(`Tap sends keycode: ${tapKey}`);
 * }
 * ```
 */
export function getTapParam(
    binding: BehaviorBindingLike,
    behaviors: BehaviorMapLike,
): number | undefined {
    const parsed = parseHoldTapBinding(binding, behaviors)
    return parsed?.tapParam
}

/**
 * Extracts the hold action parameter from a hold-tap binding
 *
 * @param binding - The behavior binding to extract from
 * @param behaviors - Map of all available behaviors
 * @returns The hold parameter value, or undefined if not a hold-tap
 *
 * @example
 * ```typescript
 * const holdAction = getHoldParam(binding, behaviorMap);
 * if (holdAction !== undefined) {
 *   console.log(`Hold activates: ${holdAction}`);
 * }
 * ```
 */
export function getHoldParam(
    binding: BehaviorBindingLike,
    behaviors: BehaviorMapLike,
): number | undefined {
    const parsed = parseHoldTapBinding(binding, behaviors)
    return parsed?.holdParam
}
