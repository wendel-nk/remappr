// Pattern check: no GoF pattern (-) — rejected — re-export shim; the helpers moved
// to the firmware-client lib, this keeps the local import path stable.
//
// The conditional (tri-)layer editor helpers now live in the lib (@firmware/config
// editorFields) so the builder shares one source of truth. Re-exported here under
// the original path so the modal's imports are unchanged.
export {
    emptyConditional,
    toggleIfLayer,
    sameConditional,
    sameConditionalList,
    conditionalLayersPatch,
    conditionalError,
} from '@firmware/config'
