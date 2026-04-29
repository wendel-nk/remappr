// pattern-check: skip barrel module — re-exports + single registerAdapter side effect
import { registerAdapter } from '@firmware/registry'
import { qmkAdapter } from './adapter'

export { qmkAdapter } from './adapter'
export { QmkKeyboardService } from './service'
export { QMK_ACTION_TYPES } from './actionTypes'

registerAdapter(qmkAdapter)
