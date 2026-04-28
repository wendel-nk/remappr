// pattern-check: skip barrel module — re-exports + single registerAdapter side effect
import { registerAdapter } from '@firmware/registry'
import { zmkAdapter } from './adapter'

export { zmkAdapter } from './adapter'
export { ZmkKeyboardService } from './service'
export {
    ZMK_CHAR_UUID,
    ZMK_CHAR_UUID_NOBLE,
    ZMK_SERVICE_UUID,
    ZMK_SERVICE_UUID_NOBLE,
} from './ble/constants'
export {
    bindingPrefix,
    bindingToKeyAction,
    buildKeyLabel,
    keyActionToBinding,
    type BehaviorMap,
    type ZmkBindingParams,
} from './actions'
export {
    behaviorToActionType,
    behaviorsToActionTypes,
    validateSlotValue,
} from './actionTypes'
export { zmkKeymapToNeutral } from './keymap'
export {
    downloadConfigFile,
    downloadConfigZip,
    generateZMKConfigFile,
    generateZMKKeymapFile,
    type ZMKConfigOptions,
} from './export'

registerAdapter(zmkAdapter)
