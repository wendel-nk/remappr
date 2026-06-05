// Pattern check: no GoF pattern (-) — rejected — a single pure merge accessor that
// reads the controller identity with a back-compat fallback; no abstraction.
//
// `keyboard.controller` is the unified controller / MCU identity (ZMK board+shield,
// QMK processor/bootloader/board/development_board, USB device version). It
// supersedes the older `hardware.board` / `hardware.shield`; this resolver lets
// every emitter read one place while still honoring pre-controller configs that
// only set `hardware.board`/`shield`. Returns only the fields that are set.

import type { CanonController, ConfigKeymap } from './types'

/** Resolve a config's controller identity, preferring `keyboard.controller` and
 *  falling back to the deprecated `hardware.board` / `hardware.shield`. */
export function resolveController(config: ConfigKeymap): CanonController {
    const c = config.keyboard.controller
    const hw = config.keyboard.hardware
    const board = c?.board ?? hw?.board
    const shield = c?.shield ?? hw?.shield
    return {
        ...(board ? { board } : {}),
        ...(shield ? { shield } : {}),
        ...(c?.processor ? { processor: c.processor } : {}),
        ...(c?.bootloader ? { bootloader: c.bootloader } : {}),
        ...(c?.developmentBoard
            ? { developmentBoard: c.developmentBoard }
            : {}),
        ...(c?.deviceVersion ? { deviceVersion: c.deviceVersion } : {}),
    }
}
