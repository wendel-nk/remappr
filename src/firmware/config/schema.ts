// Pattern check: no GoF pattern (-) — rejected — zod surface-schema definitions + a cross-reference validation pass; declarative data, no GoF abstraction.
//
// The SURFACE schema — what a user writes in remappr.keymap.json. It is
// permissive on spelling (bare-string keys, mod_tap/layer_tap presets, "Ctrl+C"
// combo strings, a `layer` umbrella) and validates structure + cross-references.
// `normalizeKeymap` (normalize.ts) lowers a parsed surface doc into the single
// canonical form (types.ts) that the rest of the pipeline consumes.
//
// Every field carries .describe() — those strings are the single source for the
// code editor's hover tooltips (Phase B), read off the schema at build time.

import { z } from 'zod'
import { MODIFIERS, isKnownKeycode, isKnownKeyToken } from './keycodes'

/* ── leaf vocabularies ─────────────────────────────────────────────────── */

export const ModifierSchema = z.enum(MODIFIERS)

export const ResolveSchema = z
    .enum(['timeout', 'prefer-hold', 'prefer-tap'])
    .describe(
        'Tap/hold interrupt policy. timeout = decide by timer; prefer-hold = hold if another key is pressed in-window; prefer-tap = tap unless held past the timer uninterrupted.',
    )

export const LightingTargetSchema = z
    .enum(['underglow', 'backlight', 'per_key'])
    .describe('Lighting axis — firmware-gated (per_key is QMK/Keychron only).')

export const LightingActionSchema = z.enum([
    'toggle',
    'on',
    'off',
    'brightness_up',
    'brightness_down',
    'hue_up',
    'hue_down',
    'saturation_up',
    'saturation_down',
    'effect_next',
    'effect_previous',
    'speed_up',
    'speed_down',
])

export const OutputActionSchema = z
    .enum([
        'usb',
        'bluetooth',
        'bluetooth_clear',
        'bluetooth_next',
        'bluetooth_prev',
        'toggle',
    ])
    .describe('Output routing. Wireless (bluetooth*) needs a BLE backend.')

export const PowerActionSchema = z
    .enum(['toggle', 'on', 'off'])
    .describe('External-power control (e.g. gating peripheral power / LEDs).')

export const MouseButtonSchema = z
    .enum(['left', 'right', 'middle', 'mb4', 'mb5'])
    .describe('Pointer button to click.')

export const DirectionSchema = z
    .enum(['up', 'down', 'left', 'right'])
    .describe('Pointer move / scroll direction.')

export const LayerModeSchema = z
    .enum(['momentary', 'toggle', 'to', 'sticky'])
    .describe(
        'momentary = active while held; toggle = flip on/off; to = switch to this layer; sticky = active for the next key only.',
    )

/** A single keycode token: "A", "Space", "KC_BSPC", or a canonical id. */
export const KeycodeSchema = z
    .string()
    .min(1)
    .superRefine((s, ctx) => {
        if (!isKnownKeycode(s)) {
            ctx.addIssue({ code: 'custom', message: `unknown keycode "${s}"` })
        }
    })
    .describe('A keycode by friendly name, firmware alias, or canonical id.')

/** A bare-string binding: a single key OR a "Ctrl+Shift+C" combo string. */
export const KeyTokenSchema = z
    .string()
    .min(1)
    .superRefine((s, ctx) => {
        if (!isKnownKeyToken(s)) {
            ctx.addIssue({
                code: 'custom',
                message: `unknown key or modifier in "${s}"`,
            })
        }
    })

/* ── sub-targets ───────────────────────────────────────────────────────── */

export const KeyPressSchema = z
    .object({
        type: z.literal('key_press'),
        key: KeycodeSchema,
        mods: z.array(ModifierSchema).optional(),
    })
    .describe('A plain (optionally modified) keypress.')

/** Tap target of a tap_hold/preset: a bare key string or an explicit key_press. */
export const TapTargetSchema = z.union([KeyTokenSchema, KeyPressSchema])

export const HoldTargetSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('modifier'), modifier: ModifierSchema }),
    z.object({ type: z.literal('layer'), layer: z.string() }),
])

const tapHoldTimings = {
    tappingTermMs: z.number().int().positive().optional(),
    quickTapMs: z.number().int().nonnegative().optional(),
    resolve: ResolveSchema.optional(),
}

/* ── the surface action union ──────────────────────────────────────────── */

export const ActionObjectSchema = z.discriminatedUnion('type', [
    KeyPressSchema,

    z
        .object({
            type: z.literal('tap_hold'),
            tap: TapTargetSchema,
            hold: HoldTargetSchema,
            ...tapHoldTimings,
        })
        .describe('General tap/hold: tap does one thing, hold another.'),

    // Friendly presets — both lower to tap_hold.
    z
        .object({
            type: z.literal('mod_tap'),
            tap: TapTargetSchema,
            mod: ModifierSchema,
            ...tapHoldTimings,
        })
        .describe('Mod-Tap preset: tap = key, hold = a modifier.'),
    z
        .object({
            type: z.literal('layer_tap'),
            tap: TapTargetSchema,
            layer: z.string(),
            ...tapHoldTimings,
        })
        .describe('Layer-Tap preset: tap = key, hold = a layer.'),

    z
        .object({
            type: z.literal('layer'),
            mode: LayerModeSchema,
            layer: z.string(),
        })
        .describe('Layer switch (mode picks momentary/toggle/to/sticky).'),

    z
        .object({ type: z.literal('sticky_key'), key: KeycodeSchema })
        .describe('One-shot key: applies to the next keypress only.'),

    z.object({ type: z.literal('caps_word') }).describe('Caps for one word.'),
    z
        .object({ type: z.literal('transparent') })
        .describe('Fall through to the layer below.'),
    z
        .object({ type: z.literal('none') })
        .describe('Explicitly inert — blocks fall-through.'),

    z
        .object({
            type: z.literal('output'),
            action: OutputActionSchema,
            profile: z.number().int().nonnegative().optional(),
        })
        .describe(
            'Output routing. profile is valid only with action "bluetooth".',
        ),

    z.object({
        type: z.literal('lighting'),
        target: LightingTargetSchema,
        action: LightingActionSchema,
    }),

    z
        .object({ type: z.literal('bootloader') })
        .describe('Reboot into bootloader.'),
    z.object({ type: z.literal('reset') }).describe('Reset the keyboard.'),

    z
        .object({
            type: z.literal('macro'),
            ref: z.string(),
            param: KeycodeSchema.optional(),
        })
        .describe('Run a named macro; `param` feeds a one-param macro.'),
    z
        .object({ type: z.literal('tap_dance'), ref: z.string() })
        .describe('Run a named tap-dance.'),

    z
        .object({ type: z.literal('soft_off') })
        .describe('Power off until a hardware reset / dedicated on key.'),
    z
        .object({ type: z.literal('studio_unlock') })
        .describe('Unlock the keyboard for ZMK Studio live editing.'),
    z
        .object({ type: z.literal('grave_escape') })
        .describe('Esc normally; Shift/GUI + this sends grave/tilde.'),
    z
        .object({ type: z.literal('key_repeat') })
        .describe('Repeat the previously pressed key.'),
    z
        .object({ type: z.literal('key_toggle'), key: KeycodeSchema })
        .describe('Toggle a key: press once to latch down, again to release.'),
    z
        .object({ type: z.literal('ext_power'), action: PowerActionSchema })
        .describe('Control external/peripheral power.'),
    z
        .object({ type: z.literal('mouse_key'), button: MouseButtonSchema })
        .describe('Click a pointer button.'),
    z
        .object({ type: z.literal('mouse_move'), direction: DirectionSchema })
        .describe('Move the pointer.'),
    z
        .object({ type: z.literal('mouse_scroll'), direction: DirectionSchema })
        .describe('Scroll the pointer wheel.'),
])

export const ActionSchema = z.union([KeyTokenSchema, ActionObjectSchema])

/* ── structure ─────────────────────────────────────────────────────────── */

export const GeometrySchema = z.object({
    x: z.number(),
    y: z.number(),
    w: z.number().positive().default(1),
    h: z.number().positive().default(1),
    r: z.number().default(0),
    rx: z.number().optional(),
    ry: z.number().optional(),
})

export const EncoderSchema = z.object({ x: z.number(), y: z.number() })

export const EncoderBindingSchema = z.object({
    cw: ActionSchema,
    ccw: ActionSchema,
    press: ActionSchema.optional(),
})

export const LayerSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    bindings: z.array(ActionSchema),
    encoders: z.array(EncoderBindingSchema).optional(),
})

export const ComboSchema = z.object({
    name: z.string(),
    keys: z.array(z.number().int().nonnegative()).min(2),
    action: ActionSchema,
    timeoutMs: z.number().int().positive().optional(),
    layers: z.array(z.string()).optional(),
})

export const TapDanceSchema = z.object({
    id: z.string(),
    description: z.string().optional(),
    tappingTermMs: z.number().int().positive().optional(),
    taps: z
        .array(
            z.object({
                count: z.number().int().positive(),
                action: ActionSchema,
            }),
        )
        .min(1),
    hold: HoldTargetSchema.optional(),
})

export const MacroStepSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('tap'), key: KeycodeSchema }),
    z.object({ type: z.literal('press'), key: KeycodeSchema }),
    z.object({ type: z.literal('release'), key: KeycodeSchema }),
    z.object({ type: z.literal('wait'), ms: z.number().int().nonnegative() }),
    z.object({ type: z.literal('text'), text: z.string() }),
    z
        .object({ type: z.literal('param') })
        .describe("Forward the binding's argument (one-param macro)."),
    z
        .object({ type: z.literal('pause_for_release') })
        .describe('Wait for the triggering key to be released.'),
])

export const MacroSchema = z.object({
    id: z.string(),
    description: z.string().optional(),
    params: z
        .union([z.literal(0), z.literal(1)])
        .optional()
        .describe('Binding-cells: 0 = plain, 1 = one-param macro.'),
    steps: z.array(MacroStepSchema).min(1),
})

const BaseKeymapSchema = z.object({
    schemaVersion: z.literal(1),
    kind: z.literal('remappr.keymap'),
    meta: z.object({
        name: z.string(),
        author: z.string().optional(),
        version: z.string().optional(),
        description: z.string().optional(),
        target: z.enum(['zmk', 'qmk', 'keychron']).nullable().default(null),
    }),
    defaults: z
        .object({
            tappingTermMs: z.number().int().positive().optional(),
            quickTapMs: z.number().int().nonnegative().optional(),
            comboTimeoutMs: z.number().int().positive().optional(),
        })
        .optional(),
    keyboard: z.object({
        id: z.string(),
        name: z.string(),
        keys: z.array(GeometrySchema).min(1),
        encoders: z.array(EncoderSchema).optional(),
    }),
    layers: z.array(LayerSchema).min(1),
    combos: z.array(ComboSchema).optional(),
    tapDances: z.array(TapDanceSchema).optional(),
    macros: z.array(MacroSchema).optional(),
})

/* ── cross-reference + structural checks ───────────────────────────────── */

type SurfaceAction = z.infer<typeof ActionSchema>

export const KeymapSchema = BaseKeymapSchema.superRefine((km, ctx) => {
    const layerNames = new Set(km.layers.map((l) => l.name))
    const macroIds = new Set((km.macros ?? []).map((m) => m.id))
    const danceIds = new Set((km.tapDances ?? []).map((t) => t.id))
    const keyCount = km.keyboard.keys.length
    const encCount = km.keyboard.encoders?.length ?? 0

    const layerRef = (name: string, path: (string | number)[]): void => {
        if (!layerNames.has(name)) {
            ctx.addIssue({
                code: 'custom',
                message: `unknown layer "${name}"`,
                path,
            })
        }
    }

    const checkAction = (b: SurfaceAction, p: (string | number)[]): void => {
        if (typeof b === 'string') return // bare key/combo — no refs to check
        if (b.type === 'tap_hold' && b.hold.type === 'layer') {
            layerRef(b.hold.layer, [...p, 'hold', 'layer'])
        }
        if (b.type === 'layer_tap') layerRef(b.layer, [...p, 'layer'])
        if (b.type === 'layer') layerRef(b.layer, [...p, 'layer'])
        if (b.type === 'macro' && !macroIds.has(b.ref)) {
            ctx.addIssue({
                code: 'custom',
                message: `unknown macro "${b.ref}"`,
                path: [...p, 'ref'],
            })
        }
        if (b.type === 'tap_dance' && !danceIds.has(b.ref)) {
            ctx.addIssue({
                code: 'custom',
                message: `unknown tap dance "${b.ref}"`,
                path: [...p, 'ref'],
            })
        }
        if (
            b.type === 'output' &&
            b.action !== 'bluetooth' &&
            b.profile !== undefined
        ) {
            ctx.addIssue({
                code: 'custom',
                message: `profile is only valid with action "bluetooth"`,
                path: [...p, 'profile'],
            })
        }
    }

    km.layers.forEach((layer, li) => {
        if (layer.bindings.length !== keyCount) {
            ctx.addIssue({
                code: 'custom',
                message: `layer "${layer.name}" has ${layer.bindings.length} bindings but the board has ${keyCount} keys`,
                path: ['layers', li, 'bindings'],
            })
        }
        if (layer.encoders && layer.encoders.length !== encCount) {
            ctx.addIssue({
                code: 'custom',
                message: `layer "${layer.name}" has ${layer.encoders.length} encoder bindings but the board has ${encCount} encoders`,
                path: ['layers', li, 'encoders'],
            })
        }
        layer.bindings.forEach((b, bi) =>
            checkAction(b, ['layers', li, 'bindings', bi]),
        )
        layer.encoders?.forEach((e, ei) => {
            checkAction(e.cw, ['layers', li, 'encoders', ei, 'cw'])
            checkAction(e.ccw, ['layers', li, 'encoders', ei, 'ccw'])
            if (e.press)
                checkAction(e.press, ['layers', li, 'encoders', ei, 'press'])
        })
    })
    ;(km.combos ?? []).forEach((combo, ci) => {
        combo.keys.forEach((k, ki) => {
            if (k >= keyCount) {
                ctx.addIssue({
                    code: 'custom',
                    message: `combo "${combo.name}" references key ${k}, out of range 0..${keyCount - 1}`,
                    path: ['combos', ci, 'keys', ki],
                })
            }
        })
        checkAction(combo.action, ['combos', ci, 'action'])
        ;(combo.layers ?? []).forEach((ln, lni) =>
            layerRef(ln, ['combos', ci, 'layers', lni]),
        )
    })
    ;(km.tapDances ?? []).forEach((td, ti) => {
        td.taps.forEach((t, tj) =>
            checkAction(t.action, ['tapDances', ti, 'taps', tj, 'action']),
        )
    })
})

/* ── types + helpers ───────────────────────────────────────────────────── */

export type SurfaceKeymap = z.infer<typeof KeymapSchema>
export type { SurfaceAction }

/** Surface action `type` names for the editor palette (bare keys map to key_press). */
export const ACTION_TYPES = [
    'key_press',
    ...ActionObjectSchema.options.map((o) => o.shape.type.value),
] as const

/**
 * Migrate a raw (pre-validation) object to the current schema version. Stub
 * today (only v1 exists); the seam keeps future bumps additive.
 */
export function migrate(raw: unknown): unknown {
    return raw
}

/** Parse + validate JSON source into a validated SURFACE doc. Throws on invalid. */
export function parseSurface(source: string): SurfaceKeymap {
    return KeymapSchema.parse(migrate(JSON.parse(source)))
}

/** Non-throwing variant — returns the SafeParse result for UI error surfacing. */
export function safeParseSurface(
    source: string,
): z.ZodSafeParseResult<SurfaceKeymap> {
    let raw: unknown
    try {
        raw = migrate(JSON.parse(source))
    } catch (e) {
        return {
            success: false,
            error: new z.ZodError([
                {
                    code: 'custom',
                    message: `JSON parse error: ${(e as Error).message}`,
                    path: [],
                    input: source,
                },
            ]),
        } as z.ZodSafeParseResult<SurfaceKeymap>
    }
    return KeymapSchema.safeParse(raw)
}
