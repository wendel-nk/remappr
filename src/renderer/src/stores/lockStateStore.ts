// pattern-check: skip type-rewrite from ZMK enum to neutral LockState string union
import {create} from 'zustand'
import {devtools} from 'zustand/middleware'
import type {LockState} from '@firmware/types'

interface LockStoreState {
    lockState: LockState
    setLockState: ( state: LockState ) => void
}

const useLockStore = create<LockStoreState>()(
    devtools( ( set ) => ({
        lockState: 'locked' as LockState,
        setLockState: ( state ) => set( () => ({lockState: state}) ),
    }) ),
)

export default useLockStore
