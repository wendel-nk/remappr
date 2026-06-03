// Pattern check: no GoF pattern (-) — rejected — barrel re-export of the config module public surface, no logic.
//
// remappr generalized keymap config. Self-contained: depends only on
// @firmware/catalog + @firmware/types. The source-of-truth document layer that
// demo seeds from, the editor syncs into, and download compiles per firmware.

export type {
    CanonAction,
    CanonEncoderBinding,
    CanonGeometry,
    CanonHoldTarget,
    CanonKeyPress,
    CanonLayer,
    CanonCombo,
    CanonMacro,
    CanonMacroStep,
    CanonTapDance,
    CanonKscan,
    CanonMatrixKscan,
    CanonDirectKscan,
    CanonMatrixTransform,
    ConfigHardware,
    ConfigKeymap,
    ConfigKeyboard,
    ConfigDefaults,
    ConfigMeta,
    DiodeDirection,
    GpioSpec,
    LayerMode,
    LightingAction,
    LightingTarget,
    OutputAction,
    Resolve,
    Target,
} from './types'

export {
    MODIFIERS,
    type Modifier,
    resolveKeycode,
    resolveModifier,
    isKnownKeycode,
    isKnownKeyToken,
    parseKeyToken,
    friendlyName,
} from './keycodes'

export {
    ACTION_TYPES,
    KeymapSchema,
    migrate,
    parseSurface,
    safeParseSurface,
    type SurfaceKeymap,
    type SurfaceAction,
} from './schema'

export { normalizeAction, normalizeKeymap, parseKeymap } from './normalize'
export {
    denormalizeAction,
    serializeKeymap,
    toSurfaceObject,
} from './serialize'

export {
    type Diagnostic,
    type DiagnosticLevel,
    type DiagnosticPath,
    DiagnosticBag,
    formatPath,
} from './diagnostics'

export {
    type FirmwareCapabilities,
    CAPABILITY_MATRIX,
    resolveAllowedTargets,
    supportsLighting,
    supportsOutput,
} from './capabilities'

export {
    type CompileResult,
    type KeymapCompiler,
    getCompiler,
    hasCompiler,
    registerCompiler,
} from './compiler'

export {
    type ActionCategory,
    type ActionMeta,
    type PaletteGroup,
    type PaletteKeycode,
    ACTION_META,
    getActionMeta,
    KEYCODE_PALETTE,
} from './editorMeta'

// Side-effect imports: each concrete compiler self-registers on load.
import './compilers/zmk'
import './compilers/qmk'
